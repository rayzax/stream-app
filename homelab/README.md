# Homelab stream proxy

Runs the exact same proxy logic (`packages/stream-proxy`) Cloud Run uses, as
its own small container on your Proxmox/Docker homelab, exposed over HTTPS
via a Cloudflare Tunnel sidecar (default) or Tailscale Funnel (swap-in,
commented in `docker-compose.yml`) — no inbound port forwarding needed.

## Why run this at all

`STREAM_MODE=cloudrun` (the default) works fine on its own — Cloud Run
proxies video itself. This exists for when egress cost from Cloud Run
proxying video gets expensive enough that routing playback through your own
homelab connection instead is worth it (see the billing budget alert).

## Setup

1. **Create a Cloudflare Tunnel** (Zero Trust dashboard → Networks →
   Tunnels → Create a tunnel). Add a public hostname for it, e.g.
   `homelab-stream.slottedgolf.us`, pointing at `http://proxy:8181`. Copy the
   tunnel token.
2. `cp .env.example .env` and fill in: the same Xtream credentials as in GCP
   Secret Manager, and the **exact same** `stream-token-hmac-key` value
   (Cloud Run issues tokens, this proxy verifies them — the key must match):
   ```
   gcloud secrets versions access latest --secret=stream-token-hmac-key --project=stream-iptv-prd
   ```
3. `docker compose up -d --build`
4. Confirm it's reachable: `curl https://homelab-stream.slottedgolf.us/healthz`
   should return `{"status":"ok"}`.

## Switching the app to homelab mode

This is meant to be a single variable change, no code changes:

- **Terraform**: set `homelab_proxy_url = "https://homelab-stream.slottedgolf.us"`
  and `stream_mode = "homelab"` in `terraform/terraform.tfvars` (or as a
  GitHub Actions variable if deploying via CI), then `terraform apply`.
- The app will health-check your homelab proxy (`GET /healthz`, ~2s timeout)
  every time it issues a stream token. If it's down, it **automatically
  falls back to Cloud Run** and the player shows "Streaming via Cloud"
  instead of "Streaming via Homelab" — no action needed on your end.

## Known limitation

The "one active upstream stream per session" enforcement (to respect your
provider's concurrent-connection limit) is in-memory per proxy process. It's
reliable here because this container is a single instance by design. If you
ever scale this to multiple replicas, that guarantee breaks down — don't do
that without adding a shared store (Redis, etc.).
