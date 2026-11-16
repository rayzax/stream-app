# Stream IPTV App — Design Reference

Mobile-first IPTV web app mockups converted to React. All placeholder content marked with `[BRACKETS]` or template references. Real assets, channel data, and scores come from backend.

---

## Global design tokens

**Colors:**
- Background: `#0B0D10`
- Card/Surface: `#14181D` (lighter), `#1C2128` (darker)
- Text: `#E8EAED`
- Muted text: `#9AA3AD`
- Accent/Links: `#3B82F6` (hover: `#60A5FA`)
- Button hover: `#2563EB`

**Typography:**
- Body: Inter 400/500/600
- Headings: Space Grotesk 500/700
- All text uses `font-family: Inter, system-ui, sans-serif` or Space Grotesk for h1/h2

**Spacing/Sizing:**
- Border radius: 10–12px (cards), 999px (pills/circles)
- Min heights: 44px (buttons/form fields)
- Gaps: 8px (compact), 12px, 16px, 20px, 24px, 32px (layout)
- Padding: 12–32px sections, 14px form fields

**No gradients, no emoji, stroke SVG icons only (width 20px, height 20px, stroke-width 2).**

**IMPORTANT OVERRIDE:** LIVE badge must be `#DC2626` with white text in the React app. Mockup shows `#EF4444`—update to darker red for better contrast.

---

## Login

**Layout:** Centered single-column form on full-height bg.

**Structure:**
- `main` (full-height flex center) → `section` (max-width 400px, border, 32px padding)
  - Logo "Stream" (Space Grotesk 32px bold)
  - Title "Sign in" (20px)
  - Form with single password input + submit button
  - Footer text "Single-user private access" (muted, 13px)

**Components:**
- `.field` input (44px min-height, 14px h-padding, bg `#1C2128`, focus outline 2px `#3B82F6`)
- `.btn` submit button (44px, bg `#3B82F6`, hover `#2563EB`)

**Data to replace:** None (single-user mockup).

---

## Main (Sports — Live now)

**Layout:** Desktop tab interface with leagues grouped by sport.

**Structure:**
- `header` (flex, gap 12/32px, bg `#14181D`, bottom border)
  - Logo "Stream" (24px)
  - `.tab` nav (Sports/TV/Movies; active has blue underline)
  - Search input (flex: 1, max 520px)
  - User menu button (44×44, circle)
- `main` (24px padding top/bottom 40px, flex column, gap 32px)
  - For each league: section heading + card grid

**Components:**
- `.tab` (inactive: muted, active: white + blue bottom border 2px)
- `.search` (100% width, 44px, border `#2A313A`)
- `.card` (bg `#14181D`, border, rounded 12px, 16px padding, flex column gap 12px)
  - Network label (muted, 14px)
  - `.pill` LIVE badge (`#EF4444` in mockup, must be `#DC2626` in real app)
  - Matchup (Space Grotesk 18px bold)
  - Score (20px bold, tabular-nums) + clock (muted 14px)
  - `.play` button (blue, 44px, flex with icon)
- `.grid` (auto-fill 260px min)

**Data to replace:**
- `leagues[].name` (e.g., "NFL", "CFB")
- `leagues[].count` (live game count)
- `games[].matchup` (e.g., "Bears at Packers")
- `games[].score` (e.g., "17 – 14")
- `games[].clock` (e.g., "Q3 · 8:42")
- `games[].network` (e.g., "FOX")
- Footer timestamps

---

## TV

**Layout:** Two-column: sidebar category filter + main channel grid.

**Structure:**
- `header` (same as Main)
- `div` (flex wrap gap 24px, padding 24/32px)
  - `aside` (220px, flex column gap 4px)
    - "Categories" label (14px muted uppercase)
    - `.cat` links (muted, active has left blue border + darker bg)
  - `section` (flex 999 1 560px)
    - Title "Entertainment" (24px)
    - Filter search input (320px max)
    - `.grid` (auto-fill 230px min)

**Components:**
- `.cat` (44px min-height, 12px h-padding, 10px border-radius, active inset left blue border 3px)
- `.tile` (bg `#14181D`, border, rounded 12px, 16px padding)
  - Channel name (17px) + number (muted 13px)
  - "Now" label (muted) + show title (600px weight)
  - `.track` progress bar (6px height, bg `#1C2128`, filled with blue)
  - "Next" label (muted) + next show title
- `.field` filter (width 100%)

**Data to replace:**
- Category list (mock: Entertainment, News, Sports Networks, Kids, Movies Channels, Local)
- `channels[].name` (e.g., "Channel 101")
- `channels[].number` (e.g., "101")
- `channels[].now` (current show title)
- `channels[].nowTime` (time range)
- `channels[].pct` (progress 0–100)
- `channels[].next` (next show title)

---

## Movies

**Layout:** Grid browse with genre chips, sort/filter controls above.

**Structure:**
- `header` (same as Main)
- `div` (padding 24/32px, flex column gap 20px)
  - Flex row: "Movies" title (28px) + controls
    - Filter search (280px max)
    - Sort dropdown (Recently added/Title A–Z/Year)
  - `.chip` buttons (genre filter; active has blue bg)
  - `.grid` (auto-fill 180px min, gap 20px)

**Components:**
- `.chip` (44px min-height, 16px h-padding, border `#2A313A`, active bg/border blue)
- `.poster` (flex column, rounded 12px, border)
  - `.art` (aspect 2:3, flex center, bg `#1C2128`, shows "[POSTER]" placeholder)
  - Info section (12/14px padding, flex column gap 4px)
    - Title (16px)
    - Year + runtime (muted 14px)
- `.select` (44px, same styling as `.field`)

**Data to replace:**
- Genre array: ['All', 'Action', 'Comedy', 'Drama', 'Horror', 'Family', 'Documentary']
- `movies[].title` (e.g., "[Movie title] 1")
- `movies[].year` (e.g., "2023")
- `movies[].runtime` (e.g., "118 min")
- Poster images (replace [POSTER] with img src)

---

## Search

**Layout:** Results grouped by type (Live sports, TV channels, Movies) with result count per group.

**Structure:**
- `header` (same as Main; search input pre-filled)
- `main` (max-width 960px center, padding 28/32px, gap 28px)
  - "Results for X" label
  - For each group: heading (18px) + result rows

**Components:**
- `.search` (active border `#3B82F6`)
- `.row` (flex, 56px min-height, 14px h-padding, rounded 10px, border, hover bg `#1C2128`)
  - Name (600px weight) + meta (muted 14px)
  - `.tag` or `.tag-live` badge (right align)
- `.tag` (muted 12px, border `#2A313A`, rounded pill)
- `.tag-live` (bg `#EF4444` mockup → `#DC2626` real app, white, bold)

**Data to replace:**
- Search query value
- `groups[].title` (e.g., "Live sports")
- `groups[].count`
- `items[].name` (e.g., "Chiefs at Broncos")
- `items[].meta` (e.g., "Q2 · 4:50 · CBS")
- `items[].tag` (LIVE / TV / MOVIE)
- `items[].href` (link target)

---

## Player

**Layout:** Video player (16:9 aspect) + sidebar with related games.

**Structure:**
- `header` (Stream logo links home, back nav "Back to Sports", status "Streaming via Cloud")
- `div` (flex wrap gap 24px, padding 24/32px)
  - `section` (flex 999 1 640px, min-width 0)
    - Video container (16:9, play button center)
    - Player controls toolbar (pause, volume, LIVE pill, quality, PiP, fullscreen)
    - Title + metadata below
  - `aside` (flex 0 1 340px, min 260px, "Other live NFL" heading)
    - `.game` links (flex, 12px padding, border, hover bg `#1C2128`)

**Components:**
- `.ctl` (44×44, bg `#1C2128`, border `#2A313A`, hover bg `#252C35`, active: border/text blue)
- `.pill` LIVE badge (same as Main)
- `.game` (flex gap 12px, border `#1C2128`, active border blue)
  - Title (600px) + meta (muted 13px)
  - LIVE pill right
- Video container: aspect-ratio 16/9, play button is 88×88 circle blue

**Data to replace:**
- `Game title · Network` (e.g., "Bears at Packers · FOX")
- Score + clock metadata
- `others[].matchup` (related live games)
- `others[].score`
- `others[].clock`
- `others[].network`
- Video src (player implementation)

---

## MobileSports

**Layout:** Mobile 390×844 fixed viewport with bottom tab bar navigation.

**Structure:**
- `header` (12/16px padding, Stream logo + search button)
- `main` (flex 1, overflow-y auto, padding 16px, gap 24px)
  - Leagues same structure as Main but compact
- `nav` (.tabbar, flex, 56px min-height per tab, bottom border-top)
  - 3 tabs: Sports (SVG globe), TV (SVG screen), Movies (SVG film strip)

**Components:**
- `.card` (14px padding, flex column gap 8px; compact vs desktop)
- `.pill` LIVE badge (11px, 2/8px padding, compact)
- `.play` button (44px, flex center, icon left)
- `.tabbar a` (flex column, gap 4px, 12px text, active color blue)
- SVG icons: globe (sports), screen (tv), film strip (movies)

**Data to replace:** Same as Main (leagues, games), smaller font sizes/spacing.

---

## Interactive patterns

- **Tab navigation:** `.tab[aria-current="page"]` toggle on section nav (Main/TV/Movies)
- **Category filter:** `.cat[aria-current="true"]` toggle in TV sidebar
- **Genre chips:** `.chip[aria-pressed="true/false"]` in Movies
- **Player controls:** `.ctl[aria-pressed="true"]` for toggle buttons
- **Active game:** `.game[aria-current="true"]` in Player sidebar, `.game[aria-current="false"]` for others
- **Mobile tabs:** `.tabbar a[aria-current="page"]` for active section

All patterns use simple CSS state selectors; no JS library required for basics. Search input has live-update binding; dynamic content uses template repeat loops (`sc-for`).

