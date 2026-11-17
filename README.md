# SyvStrm

A private, mobile-first IPTV web app: Sports (live-now, grouped by league),
Live TV (full channel browser + a curated cable-guide view), Stream
(on-demand movies and TV series, with watch history and genre rows), and
global search — backed by an Xtream Codes provider, deployed on Cloud Run.

- **Frontend:** React + Vite, PWA (installable, works like a native app on
  your phone's home screen), hls.js/mpegts.js video playback.
- **Backend:** Node + Fastify. Fetches and caches the Xtream catalog + XMLTV
  guide, filters to US content, issues short-lived signed stream tokens
  (the browser never sees provider credentials or raw HTTP stream URLs).
- **Auth:** multi-user, role-based (`admin` / `user`) — users live in
  Firestore. Admins get an in-app Admin Portal to manage users and to pin
  specific channels to games (overriding/supplementing the automatic sports
  detection). Regular users only see the normal app.
- **Infra:** Terraform (Cloud Run, Artifact Registry, Secret Manager,
  Firestore, a GCS cache bucket, custom domain mapping, a billing budget
  alert), deployed via GitHub Actions.
- **Video delivery** is pluggable: Cloud Run proxies video by default
  (`STREAM_MODE=cloudrun`); a homelab container can take over later to cut
  egress cost, with automatic fallback to Cloud Run if it's down.

## Repo layout

```
apps/
  api/      Fastify backend (Cloud Run service; also serves the built frontend)
  web/      React + Vite frontend
packages/
  stream-proxy/   Shared proxy logic (token verify, upstream fetch, playlist
                   rewriting) — used by Cloud Run and the homelab image
terraform/  Infrastructure as code
homelab/    Optional homelab proxy image + docker-compose + its own README
scripts/    bootstrap.sh, setup-secrets.sh, create-admin-user.sh
```

## Prerequisites

- A GCP project with billing enabled, and `gcloud` authenticated
  (`gcloud auth login` **and** `gcloud auth application-default login` —
  Terraform needs the latter).
- `terraform` >= 1.6, Node.js >= 22, Docker.
- `gh` CLI authenticated against the GitHub repo, if you want bootstrap.sh
  to set repo variables automatically (otherwise it prints them for you to
  set by hand).
- Your Xtream Codes server URL, username, and password.

## First-time setup

1. **Bootstrap** (creates the Terraform state bucket, the GitHub Actions
   deploy service account, and Workload Identity Federation — the things
   Terraform itself can't create because it needs them to run):
   ```
   PROJECT_ID=your-project REGION=us-central1 GITHUB_REPO=owner/repo \
     DOMAIN=stream.yourdomain.com BILLING_ACCOUNT_ID=XXXXXX-XXXXXX-XXXXXX \
     ./scripts/bootstrap.sh
   ```
2. ```
   cd terraform
   terraform init -backend-config="bucket=your-project-tfstate" -backend-config="prefix=stream-app"
   cp terraform.tfvars.example terraform.tfvars   # fill in your values
   terraform apply
   ```
   This stands up everything except the real app image (the Cloud Run
   service starts on a placeholder image until CI pushes a real one) and
   the real secret values.
3. **Secrets + your first admin login** — run these yourself, locally,
   interactively. Nothing you type is echoed, written to disk, or
   committed:
   ```
   npm install    # once, from repo root — installs apps/api's bcrypt + Firestore client
   PROJECT_ID=your-project ./scripts/setup-secrets.sh         # Xtream creds + signing keys -> Secret Manager
   PROJECT_ID=your-project ./scripts/create-admin-user.sh     # your first login -> Firestore
   ```
   After that, sign in and create any other users from the Admin Portal in
   the app itself (the shield icon in the header, admins only) — no more
   scripts needed for that.
4. **DNS**: `terraform output dns_records_to_add` tells you the CNAME to
   add at your DNS provider. **If your DNS is proxied through Cloudflare
   (orange cloud), switch that record to "DNS only" (grey cloud) first** —
   Google can't provision the managed TLS certificate for your custom
   domain through a proxy. You can switch it back to proxied afterward.
5. **Deploy**: push to `main`, or run the `Deploy` workflow manually from
   the Actions tab (`workflow_dispatch`). It builds the app image, pushes
   it to Artifact Registry, and re-applies Terraform with that image.

## Local development

```
cp .env.example .env   # fill in Xtream creds + generate keys (openssl rand -base64 32)
npm install
npm run build -w @stream/proxy   # build order matters: proxy -> api
npm run dev -w stream-api        # backend on :8080
npm run dev -w stream-web        # frontend on :5173 (proxies /api, /stream to :8080)
```

Or the full container build, matching production:
```
docker compose up --build
```

## Switching to homelab streaming mode

See `homelab/README.md` for the full setup. Once your homelab proxy is
running and reachable over HTTPS, it's a single variable change:

```
terraform apply -var="stream_mode=homelab" -var="homelab_proxy_url=https://your-homelab-proxy"
```

(or set the `STREAM_MODE` / `HOMELAB_PROXY_URL` GitHub Actions variables and
redeploy). The player shows "Streaming via Homelab" when active, and falls
back to "Streaming via Cloud" automatically if your homelab proxy's health
check fails.

## Managing users

Sign in as an admin and open the Admin Portal (shield icon in the header)
to create/disable/delete users, change roles, and reset passwords. There's
always at least one enabled admin enforced server-side — you can't demote,
disable, or delete the last one. If you ever lock yourself out entirely
(e.g. deleted via Firestore directly), re-run `scripts/create-admin-user.sh`.

## Rotating secrets

- **Stream-token HMAC key**: rotating this invalidates all currently-issued
  stream tokens (anyone mid-playback has to reload). Generate a new one and
  write it with the same pattern `setup-secrets.sh` uses:
  ```
  openssl rand -base64 32 | gcloud secrets versions add stream-token-hmac-key --project=your-project --data-file=-
  ```
  If you're running the homelab proxy, update its `.env` to match and
  restart it — the key must be identical on both sides.
- **Session signing key**: same idea, via `session-signing-key` — rotating
  it logs out every active session (safe, just re-login).

## Known limitations

- **In-memory, per-process state**: login rate-limiting and the "one active
  stream per session" enforcement live in memory, not Firestore. This is
  why Cloud Run's `max_instance_count` is pinned to 1 — reliable
  enforcement needs a single instance. Don't raise it without adding a
  shared store (e.g. moving these into Firestore/Redis) first.
- **Stream concurrency is per logged-in user, not account-wide**: all app
  users share one underlying Xtream subscription. If your provider only
  allows N concurrent connections, two different app users streaming at
  once can still exceed that — the one-active-stream guard only dedupes a
  single user's own multiple devices/tabs, not across different users.
- **Sports detection** is heuristic (provider event-channel naming +
  XMLTV "now playing" + a loose team-name match against ESPN's public
  scoreboard). It won't be perfect for every provider/channel naming
  convention — see `US_FILTER_PATTERNS` and the matching logic in
  `apps/api/src/services/catalogCache.ts` if your provider's categories or
  channel names don't fit the assumed pattern.
- **MKV VOD titles** may not play in-browser (no universal browser codec
  support) — flagged in the UI, not blocked.
