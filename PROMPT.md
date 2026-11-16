# Claude Code prompt — Stream (private IPTV web app)

Paste everything below the line into Claude Code, run from the repo root that contains the `design/` folder.

---

Build and deploy a private IPTV web app on GCP, end to end. You have my authenticated gcloud session; do all setup yourself, use subagents where work can run in parallel, and keep a task list.

## ⚠️ THIS NEEDS TO BE MOBILE FRIENDLY ⚠️
Mobile is a first-class target, not an afterthought. I will mostly use this on my phone.
- Design mobile-first; every screen must work at 360–430px wide with no horizontal scrolling (except deliberate carousels).
- Bottom tab bar (Sports / TV / Movies) on phones; top tabs on desktop. Search reachable in one tap.
- Touch targets ≥ 44px, no hover-only interactions, safe-area insets (notch / home indicator) respected.
- Video player: tap-to-play, `playsinline`, native fullscreen and landscape rotation, Picture-in-Picture, works on iOS Safari (use native HLS on iOS, hls.js elsewhere) and Android Chrome.
- Installable PWA (manifest, icons, standalone display) so it opens like an app from the home screen.
- Fast on cellular: lazy-load posters, paginate/virtualize long lists, small JS bundle.
- Test every screen in responsive mode at 390×844 and 1440 wide (Playwright mobile emulation), and include screenshots of both in your final report.

## UI spec — follow the approved mockups in `design/`
`design/*.dc.html` are the approved mockups (one HTML file per screen; `design/canvas.json` lists them). Treat them as the visual spec — layout, colors, type, components — not as code to ship. Rebuild them in React.
- Screens: `Login`, `Main` (Sports, live now), `TV`, `Movies`, `Search` (global results), `Player`, `MobileSports` (phone layout reference — apply the same mobile pattern to TV, Movies, Search, Player and Login).
- Look: background #0B0D10, surfaces #14181D / #1C2128, text #E8EAED, muted #9AA3AD, accent #3B82F6, LIVE badge **#DC2626** with white text (darker than the mockup's #EF4444, for contrast). Inter body, Space Grotesk headings. 10–12px radii, no gradients, no emoji, stroke SVG icons.
- Placeholder content in the mockups (channel names, scores, [POSTER]) gets replaced by real data.

## Decisions (already made)
- Source: Xtream Codes API (server URL, username, password). HTTP only — the provider does NOT offer HTTPS. Use player_api.php (get_live_categories, get_live_streams, get_vod_categories, get_vod_streams, get_vod_info) and xmltv.php for the guide.
- Auth: app login page, single user. bcrypt password hash + session signing key in Secret Manager, HttpOnly/Secure/SameSite signed cookie (long-lived so I'm not re-logging on my phone constantly), rate-limited login. No database.
- Hosting: one Cloud Run service (backend + built frontend), custom domain via Cloud Run domain mapping (output the DNS records I need).
- Video delivery is pluggable via STREAM_MODE:
  - "cloudrun" (DEFAULT, start here): the Cloud Run service proxies video. Accept the egress cost for now.
  - "homelab" (optional, later): a small proxy container on my Proxmox/Docker homelab exposed over HTTPS via Cloudflare Tunnel or Tailscale Funnel. Switching should be a single Terraform variable / GitHub var change plus starting the container — no code changes.
  - When homelab mode is on: if the homelab proxy's health check fails, automatically fall back to Cloud Run. The player shows a small badge: "Streaming via Cloud" / "Streaming via Homelab".
- IaC: Terraform with remote state in a GCS bucket. CI/CD: GitHub Actions.

## App (Cloud Run)
- Backend (Node/TypeScript + Fastify, or similar): fetch and cache Xtream catalog + XMLTV on a schedule (in memory, refresh every 15–30 min, persist last good copy to GCS for fast cold starts).
- US-only filtering: keep live/VOD categories matching US/USA/EN patterns (configurable regex list); drop the rest.
- Three tabs: Sports, TV (US live channels by category, now/next from the guide), Movies (US VOD poster grid, genre chips, sort, details via get_vod_info).
- Search: per-tab filter and global search across all three (fuzzy), results grouped by type as in `design/Search.dc.html`.
- Sports tab: live-right-now only, grouped by league — Live NFL, Live CFB, Live NBA, Live CBB, Live MLB, Live NHL, Live Soccer, Live UFC/Boxing, etc. Show an empty-state line for leagues with nothing live. Detect from (a) XMLTV programmes airing now on sports channels and (b) provider event channels (e.g. "NFL 03: Team A vs Team B"), cross-checked against ESPN's public scoreboard JSON for in-progress games, score and clock. Each entry is a direct tap-to-play link. Auto-refresh every ~60s.
- Player: per `design/Player.dc.html` — includes an "other live games in this league" switcher.
- Stream URL issuing: the browser never sees provider credentials or http URLs. The app issues signed, short-lived stream tokens (HMAC key in Secret Manager; stream id, type, expiry ~6h, session id) pointing at whichever proxy is active.
- Frontend: React + Vite, last-watched channels, hls.js with mpegts.js fallback (native HLS on iOS). Flag MKV VOD titles as possibly unplayable in browser.

## Stream proxy (shared module, used by Cloud Run now and the homelab later)
- Verifies the token, fetches upstream from the Xtream server over HTTP, serves over HTTPS. Live: request .m3u8 output, rewrite playlist + segment URLs back through the proxy. VOD: pass through with Range support.
- Rejects anything without a valid token (no open relay). One active upstream stream per session to respect provider connection limits; clean up on disconnect. /healthz endpoint.
- Also ship the homelab version now so it's ready: docker-compose.yml (proxy + cloudflared or tailscale sidecar), .env.example, README section. A GitHub Actions job builds/pushes the proxy image to GHCR.

## Terraform
- Enable APIs, Artifact Registry repo, Cloud Run service (min instances 0, sensible max, request timeout 3600s), least-privilege runtime service account, Secret Manager secrets (Xtream server/user/pass, app password hash, session key, stream-token HMAC key), GCS cache bucket, domain mapping, variables STREAM_MODE (default "cloudrun") and HOMELAB_PROXY_URL (default empty). Parameterized by project_id, region, domain so it deploys into any GCP project.
- Add a billing budget alert (e.g. $25/month, configurable) so I know when egress gets expensive enough to switch to the homelab.

## GitHub Actions
- Bootstrap script (run once, reusable by anyone): creates tfstate bucket, deploy service account, Workload Identity Federation pool/provider bound to the repo, and sets repo secrets/vars (use gh if available, otherwise print them).
- deploy.yml: workflow_dispatch (one click) + optional on push to main → auth via WIF (fallback: GCP_SA_KEY secret) → build & push app image → terraform init/apply with the image tag. Separate job builds/pushes the homelab proxy image.
- Secret values set via a one-time script, never committed. README: prerequisites, bootstrap, secrets, switching to homelab mode, rotating the app password and HMAC key.

## Process
1. First check whether the provider blocks Google Cloud IPs: from Cloud Shell or a short Cloud Run job, curl player_api.php and one stream URL. If GCP is blocked, stop and tell me.
2. Ask me for: project ID, region, domain, GitHub repo, budget alert amount. Prompt for the Xtream login and app password interactively and write them straight to Secret Manager — never echo or commit them.
3. Build, test locally (docker compose), run Playwright checks at 390×844 and 1440 wide, bootstrap, deploy via the workflow.
4. Verify on the deployed URL: login, all three tabs, global search, live sports grouping, playback of one live channel and one movie — on mobile emulation AND desktop.
5. Finish with the URL, DNS records to add, mobile + desktop screenshots, estimated monthly cost, and the exact steps to switch to homelab mode later.
