# SyvStrm — notes for Claude Code

- App is branded "SyvStrm" in user-facing text only. Internal identifiers (npm workspaces `stream-api`/`stream-web`/`@stream/proxy`, GCP project `stream-iptv-prd`, Cloud Run service `stream-app`, the GitHub repo `stream-app`, Terraform resource names) are **not** part of the rename — see docs/design-direction.md "Brand" section.

- **Invoke the `frontend-design` skill before any frontend work**, if it's installed in the session (`/plugin install frontend-design@claude-code-plugins`). If it isn't available, read `docs/design-direction.md` first instead and stay inside that declared direction rather than defaulting to generic Tailwind/shadcn looks.
- Design direction is locked in `docs/design-direction.md` — one aesthetic, not re-decided per screen.
- This provider's live channels are continuous raw MPEG-TS, not real HLS — see the comments in `packages/stream-proxy/src/xtreamUpstream.ts` before reaching for hls.js again. VOD is a direct file passthrough (Range support), also not HLS.
- Cloud Run gotcha: any URL **path segment** over ~100 chars 404s silently on the default `*.run.app` domain (looks like GFE-level path handling, not a Fastify limit). Stream tokens use query params for exactly this reason — don't move them back to path segments.
- `terraform apply`/`plan` run locally must pin `-var="app_image=<current real tag>"` (check with `gcloud run services describe stream-app --region=us-central1 --project=stream-iptv-prd --format="value(spec.template.spec.containers[0].image)"`) — `terraform.tfvars` doesn't have it set, so a bare local plan will try to reset the running image back to the Terraform variable's placeholder default.
