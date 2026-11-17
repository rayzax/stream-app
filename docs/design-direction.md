# Design direction — SyvStrm

Declared before writing any UI code. One direction, committed to for every screen. Supersedes the original "dark broadcast control room" direction — kept the type system and motion rules, replaced the palette and brand.

## Direction: "Private members' lounge"

Think a members-only screening room, not a sports bar. Deep navy instead of near-black, warm cream instead of cool gray-white, gold as the single luxury accent instead of broadcast blue. Still high-contrast and confident — just warmer and quieter. "Live" stays a separate, deliberately un-luxurious red: urgency shouldn't look elegant.

## Palette

- `--bg: #0A0D16` — deep navy ground, not black (a true black would read "sports app," not "lounge").
- `--surface: #11162A`, `--surface-2: #171D38`, `--surface-3: #202849` — three stacked navy depths.
- `--border: #2D3660`, `--border-strong: #424E85` — cool navy borders, not warm grays, so gold reads as the one warm note in the UI.
- `--text: #F3EADA` — warm cream, not white. `--muted: #B6A98C` — warm muted gold-taupe. `--muted-2: #8A8068`.
- `--accent: #D4AF37` (classic gold) — interactive chrome: links, focus, primary buttons. `--accent-hover: #E4C158`, `--accent-light: #E8CB73`.
- `--on-accent: #0A0D16` — **text/icon color for anything sitting ON a gold background.** Gold is light; white text on it fails contrast and looks cheap. This token exists specifically so no one reaches for `color: #fff` next to `background: var(--accent)` again.
- `--live: #9B2242` (deep garnet, not fire-engine red) with white text — still unmistakably "this is happening now," but a shade that doesn't fight the gold.
- Depth comes from the three navy surface tones + a soft `--live` glow on live cards only (unchanged principle, new color). No gradients.

## Type (unchanged)

- **Display / scores / league headers / nav:** Big Shoulders, self-hosted.
- **Body:** Hanken Grotesk, self-hosted.
- No Inter, no system-ui stack, no Roboto/Arial.
- Tabular numerals on every score/clock.

## Shape & depth (unchanged)

- 10–12px radii. No `shadow-md`-as-depth. No gradients.

## Motion (unchanged — see the hard budget from the prior UI-upgrade PR)

- Live score changes: number-flip, transform/opacity only.
- Tab switches: View Transitions cross-fade.
- Sports/Stream rows: Embla, CSS scroll-snap.
- Everything else: CSS transitions, 120–300ms, transform/opacity only.

## What this rules out

- White text on a gold background anywhere (buttons, pressed chips, the play button) — always `--on-accent`.
- Blue as an accent anywhere (the previous direction's signature color — fully retired, not just "also available").
- A pure-black background — navy, always.
- Inter/Roboto/Arial/system-ui, gradients, non-transform/opacity animation, entrance animation on long lists (unchanged from before).

## Brand

App name is **SyvStrm** (was "Stream"). Scope: user-visible text only — page titles, the header wordmark, the PWA manifest name, README/docs headings. Internal identifiers (npm workspace names `stream-api`/`stream-web`/`@stream/proxy`, the GCP project `stream-iptv-prd`, the Cloud Run service `stream-app`, the GitHub repo `stream-app`, Terraform resource names) are **not** part of this rename — renaming live GCP/DNS/CI identifiers is a disruptive infra change nobody asked for here, not a rebrand.
