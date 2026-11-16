# Design direction — Stream

Declared before writing any UI code, per the UI-upgrade brief. One direction, committed to for every screen.

## Direction: "Dark broadcast control room"

The reference point is a sports network's live control room / scoreboard overlay — not a generic streaming-app template. Confident, high-contrast, built around *live* as the hero state.

## Palette

Kept the existing dark ground (it already reads well) but made the accent usage intentional instead of flat:

- `--bg: #0B0D10` — near-black ground, slightly cool.
- `--surface: #14181D`, `--surface-2: #1C2128` — two stacked card depths (not one flat gray).
- `--surface-3: #242A32` — a third, lighter depth for hover/active states and raised elements (drawers, menus).
- `--border: #2A313A`, `--border-strong: #3A4350` — borders get stronger near interactive focus.
- `--text: #E8EAED`, `--muted: #9AA3AD`, `--muted-2: #6B7480` — three text tiers, not two.
- `--accent: #3B82F6` (interactive/navigation — links, buttons, focus) — the *cool* signal.
- `--live: #DC2626` (live/urgent only — never used for ordinary interactive chrome) — the *hot* signal. This separation (one cool accent for "you can click this," one hot accent reserved exclusively for "this is happening right now") is the core of the direction.
- Depth comes from layered surfaces + a soft `--live` glow on live cards (`box-shadow`, not a gradient — the brief rules out gradients and default Tailwind flatness).

## Type

- **Display / scores / league headers / nav:** Big Shoulders (variable, condensed + bold axis) — a real scoreboard-condensed face, self-hosted. Used at tight tracking for scores and section headers.
- **Body:** Hanken Grotesk (variable) — closer in spirit to Inter's neutrality but with more character, self-hosted. Used for everything else: channel names, descriptions, form fields, buttons.
- No Inter, no system-ui stack, no Roboto/Arial as primary faces.
- Tabular numerals (`font-variant-numeric: tabular-nums`) on every score/clock, so they don't jitter when they update.

## Shape & depth

- 10–12px radii (unchanged — already distinct from the shadcn/Tailwind default 6–8px rounded-lg look).
- No drop-shadow-as-depth (`shadow-md` default look). Depth comes from: stacked surface tones, 1px borders that lighten near focus/hover, and a `--live` glow exclusively on cards/badges that are actually live.
- No gradients anywhere (unchanged rule, kept from the original design notes).

## Motion (see also the hard budget in the PR)

- Live score changes: a short number-flip (transform/opacity only), not a layout shift.
- Tab switches: a View Transitions cross-fade (CSS only, progressive enhancement).
- Sports/Movies rows: Embla carousels with CSS scroll-snap, not JS-computed positions.
- Everything else: CSS transitions on `transform`/`opacity` only, 120–300ms.

## What this rules out

- Any screen reverting to flat `surface + shadow-md + rounded-lg` cards with no hierarchy.
- Inter/Roboto/Arial/system-ui as a primary face.
- Decorative gradients.
- Animating anything other than transform/opacity.
- Entrance animations on long lists (Movies grid, TV channel grids) — those get skeleton loading states instead, not staggered reveals.
