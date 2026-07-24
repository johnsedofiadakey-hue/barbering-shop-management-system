# Handoff: Dark Charcoal + Gold Design System Upgrade (BarberManager)

## Overview
A full visual re-skin of the BarberManager web app, unifying the interface into one
cohesive **dark charcoal + muted gold** "old-money barbershop" system. Today the app
mixes dark chrome (header / sidebar / footer) with **light cream cards floating on top**,
which reads as two clashing themes. This upgrade merges everything: cards, tables and
panels become elevated warm-charcoal surfaces on a deep near-black canvas, with gold used
sparingly for accents (active nav, CTAs, icons, star ratings, eyebrow labels).

Typography moves from Playfair Display (serif) + Inter to an **all-sans, modern** pairing:
**Schibsted Grotesk** (headings + big numbers) and **Hanken Grotesk** (body / UI).

## About the Design Files
The files in this bundle are **design references created in HTML** — a prototype showing
the intended look and behavior. They are **not** production code to copy directly.

Your task is to **recreate this design in the existing BarberManager codebase**
(React + Vite + SCSS modules) using its established patterns. This is a re-skin, not a
rebuild: **the component structure, routing, and logic all stay the same.** Almost all of
the visual change flows through two files —
`frontend/src/styles/variables.module.scss` and `frontend/src/styles/global.scss` —
because the existing components already read those SCSS variables. A handful of component
`.module.scss` files need small targeted edits (listed under "Per-component notes").

## Fidelity
**High-fidelity (hifi).** All colors, typography, spacing, and radii below are final and
exact. Recreate pixel-for-pixel using the codebase's existing components and SCSS-variable
system. The prototype (`BarberManager.dc.html`) is the source of truth for appearance.

---

## Design Tokens
These are the new values. The left column is the existing SCSS variable in
`variables.module.scss`; replace its value with the new one. (Add new variables where noted.)

### Core palette
| Variable | Old value | **New value** | Role |
|---|---|---|---|
| `$color-main` | `#0e0e0e` | `#0b0a09` | Page canvas (deepest, behind everything) |
| `$color-primary` | `#1c1712` | `#111010` | Chrome bg: header, sidebar, (footer uses `#0d0b08`) |
| `$color-accent` | `#b8842a` | `#c5a059` | Gold — active nav bg, primary accents |
| `$color-gold` | `#c5a059` | `#c5a059` | Primary gold (unchanged) — CTAs, icons, stars |
| `$color-gold-strong` | `#d4b171` | `#d4b171` | Gold hover / emphasis (unchanged) |
| `$color-secondary` | `#ece4d4` | `#ece4d4` | Primary heading/text on dark (unchanged) |
| `$color-on-dark` | `#e4e4e7` | `#f4eede` | Brightest ivory — big numbers, H1 |
| `$color-muted` | `#a1a1aa` | `#8f887c` | Secondary / label text (warm) |

### New surface + text tokens (add these)
```scss
// Elevated surfaces (warm charcoal). Cards use a subtle top-to-bottom gradient:
$color-surface-top:    #181410;  // gradient start
$color-surface-bottom: #141109;  // gradient end
// -> background: linear-gradient(180deg, $color-surface-top 0%, $color-surface-bottom 100%);

$color-surface-panel-top:    #161209; // large panels (Barbers table container, login card)
$color-surface-panel-bottom: #120f08;

$color-surface-inset:  #0f0c07;  // input fields, insets
$color-icon-chip-bg:   #211a10;  // gold icon circle background on dark
$color-footer-bg:      #0d0b08;

// Text
$text-strong:  #f4eede;  // H1, big stat numbers
$text-body:    #c9c2b5;  // body copy
$text-muted:   #8f887c;  // labels, secondary
$text-dim:     #6f695f;  // footer, hints
$text-faint:   #5f5849;  // footer icons, "Est. 2025"

// Borders (warm, low-contrast)
$border-hair:      #201a13;  // chrome dividers (sidebar/header/footer edges)
$border-surface:   #29221a;  // stat card border
$border-panel:     #2b241a;  // large panel border
$border-subtle:    #2c2419;  // buttons, inputs, action btns
$border-gold-dim:  #3a2f1c;  // gold-tinted borders (icon chips, avatars, active toggles)
$border-row:       #1e1810;  // table row separators
```

### Status tag colors (dark-friendly, muted)
```scss
// Active (green)
$tag-active-bg:     rgba(120,158,108,.12);
$tag-active-text:   #94c07f;
$tag-active-border: rgba(120,158,108,.32);
// Invited / pending (gold)
$tag-invited-bg:     rgba(197,160,89,.12);
$tag-invited-text:   #d4b171;
$tag-invited-border: rgba(197,160,89,.34);
```

### Radii (already present, confirm)
`$border-radius: 8px` (buttons/inputs → design uses **10px**),
cards **16px**, large panels **18px**, icon chips **13px**, pills/tags **20px**, avatars 50%.
Suggest: keep `$border-radius: 10px`, `$border-radius-lg: 16px`, add `$border-radius-panel: 18px`.

### Spacing
Content padding: `40px 44px 48px`. Card padding: `24px`. Panel head padding: `26px 30px 22px`.
Table row padding: `16px 30px`. Grid gaps: dashboard `20px`.

---

## Typography
Replace the Google Fonts import in `global.scss`:
```scss
@import url('https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@500;600;700;800&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');
```
```scss
$font-heading: 'Schibsted Grotesk', sans-serif; // H1/H2, big stat numbers, brand wordmark
$font-body:    'Hanken Grotesk', sans-serif;     // body, UI, buttons, labels
```
Note `html { font-size: 62.5% }` stays (1rem = 10px). Sizes below are in px for clarity —
convert to rem if you prefer (÷10).

### Type scale (exact)
| Use | Font | Size | Weight | Tracking | Color |
|---|---|---|---|---|---|
| Page H1 ("Dashboard") | Schibsted Grotesk | 34px | 700 | -0.02em | `#f4eede` |
| Panel H1 ("Barbers") | Schibsted Grotesk | 26px | 700 | -0.02em | `#f4eede` |
| Login H1 | Schibsted Grotesk | 42px | 700 | -0.025em, lh 1.08 | `#f4eede` |
| Big stat number | Schibsted Grotesk | 40px | 700 | -0.02em, tabular-nums | `#f4eede` |
| Eyebrow label ("OVERVIEW","ROSTER") | Hanken Grotesk | 11–11.5px | 600 | 0.20–0.22em, UPPERCASE | `#c5a059` |
| Table column header | Hanken Grotesk | 11px | 600 | 0.14em, UPPERCASE | `#8a8172` |
| Stat card label | Hanken Grotesk | 11.5px | 600 | 0.13em, UPPERCASE | `#8f887c` |
| Body / description | Hanken Grotesk | 14.5–15.5px | 400 | — | `#8f887c` / `#c9c2b5` |
| Nav item | Hanken Grotesk | 14.5px | 500 (600 active) | 0.005em | `#b0a894` (active `#1a140b`) |
| Name in table | Hanken Grotesk | 14.5px | 600 | — | `#ece4d4` |
| Handle in table | Hanken Grotesk | 12.5px | 400 | — | `#c5a059` |
| Brand wordmark | Schibsted Grotesk | 19px | 700 | -0.02em | `Barber` `#ece4d4` + `Manager` `#7d766a` |

---

## Screens / Views

### 1. App chrome (Header + Sidebar + Footer) — `components/layout/*`
**Header** (`Header/Header.module.scss`), height **66px**, bg `#111010`, bottom border
`1px solid #262019`, padding `0 26px`, flex space-between.
- Left: logo mark (34×34, radius 9px, `box-shadow:0 0 0 1px #2c2419`) + wordmark.
- Right (authenticated): "Logout" ghost button (38px tall, radius 9px, border `1px #2c2419`,
  text `#b8b2a7`; hover border `#4a3f2c`, text `#ece4d4`) + circular avatar (38px, bg `#1c1810`,
  border `1px #3a2f1c`, gold initial `#c5a059`).
- Right (unauthenticated / login): gold "Log in" button (bg `#c5a059`, text `#1a140b`,
  weight 600; hover bg `#d4b171`).

**Sidebar** (`Sidebar/Sidebar.module.scss`), width **266px** open / **78px** collapsed,
bg `#111010`, right border `1px solid #201a13`, `transition: width .25s cubic-bezier(.4,.05,.2,1)`.
- Collapse toggle: 30px circle, absolutely positioned `top:26px; right:-15px`, border
  `1px #3a2f1c`, bg `#1a140b`, gold menu icon; hover bg `#241b0f`.
- Profile block (top): 44px avatar circle (bg `#1c1810`, border `1px #3a2f1c`, gold initial),
  name `#ece4d4` 14.5/600, role UPPERCASE 11px/500 `#7d766a` tracked 0.16em. Bottom border
  `1px #201a13`.
- Nav items: full-width buttons, 46px tall, radius 11px, gap 13px, padding `0 15px`, 4px
  bottom margin. **Inactive:** transparent bg, text `#b0a894`, icon `#8f887c`; hover bg
  `rgba(197,160,89,.07)`, text `#ece4d4`. **Active:** bg `#c5a059`, text+icon `#1a140b`,
  weight 600; hover bg `#d4b171`. Icons are 20px, recolored to match text.
- Footer strip inside sidebar: scissors icon (16px, `#5f5849`) + "EST. 2025" UPPERCASE
  11px `#5f5849` tracked 0.14em, top border `1px #201a13`.

**Footer** (`Footer/Footer.module.scss`), height **54px**, bg `#0d0b08`, top border
`1px solid #201a13`, padding `0 40px`, flex space-between:
- Left: small wordmark (`Barber` `#8a8172` / `Manager` `#5f5849`, Schibsted 13px/700).
- Center: github / docs / bug icons (16px, `#5f5849`; hover `#c5a059`).
- Right: "© 2025 CreepyMemes. All rights reserved." 12px `#5f5849`.

### 2. Admin Dashboard — `pages/admin/AdminDashboard` + `components/ui/StatCard`
Layout: page padding `40px 44px 48px`, `max-width:1400px`.
- Page header: eyebrow "OVERVIEW" (gold) → H1 "Dashboard" → description
  "Your shop at a glance — revenue, bookings and barber performance." (`#8f887c`).
- Grid: `repeat(3, 1fr)`, gap `20px`. 9 stat cards.
- **StatCard**: bg `linear-gradient(180deg,#181410,#141109)`, border `1px #29221a`,
  radius 16px, padding `24px 24px 26px`; hover border `#3a2f1c`.
  - Header row: 46px gold icon chip (circle, bg `#211a10`, border `1px #3a2f1c`, 22px gold
    icon `#c5a059`) + UPPERCASE label (11.5px/600, `#8f887c`, tracked 0.13em).
  - Value: Schibsted 40px/700 `#f4eede`, tabular-nums.
  - **Average Rating card** shows a radial instead of a number: 74px ring
    `conic-gradient(#c5a059 <pct>%, #2a231a 0)` with a 56px inner circle (bg `#141109`)
    containing "4.0" (Schibsted 22px/700 `#f4eede`) + "/5" (11px `#8f887c`), and caption
    "Across all reviewed cuts" (13px `#8f887c`). pct = rating/5 × 100.
  - Stats & labels: Total Revenue `$173.59`, Total Barbers `5`, Total Appointments `27`,
    Completed Appointments `6`, Ongoing Appointments `6`, Cancelled Appointments `15`,
    Total Clients `29`, Total Reviews `2`, Average Rating `4.0`.

### 3. Admin Barbers — `pages/admin/AdminBarbers` + `components/common/Pagination`, `Tag`, `ui/Profile`, `ui/Rating`
Layout: page padding `40px 44px 48px`, `max-width:1500px`. One large panel:
bg `linear-gradient(180deg,#161209,#120f08)`, border `1px #2b241a`, radius 18px, overflow hidden.
- **Panel head** (padding `26px 30px 22px`, bottom border `1px #241d13`, space-between):
  - Left: 48px icon chip (radius 13px, bg `#211a10`, border `1px #3a2f1c`, 26px gold barber
    icon) + eyebrow "ROSTER" (gold) + H1 "Barbers".
  - Right: "Refresh barbers" secondary button (42px, radius 10px, border `1px #2c2419`,
    bg `#191309`, text `#d7d0c3`, gold refresh icon; hover border `#4a3f2c`, bg `#1f180d`)
    + "Invite barber" gold primary button (bg `#c5a059`, text `#1a140b`, `+` icon in `#1a140b`;
    hover bg `#d4b171`).
- **Table** via CSS grid, columns `2.1fr 2.2fr 1.1fr 1fr 1.1fr 1fr 0.9fr`, gap 16px.
  - Header row: padding `15px 30px`, bg `#17120a`, bottom border `1px #241d13`; each column
    = 14px muted icon (`#8a8172`) + UPPERCASE 11px/600 label `#8a8172` tracked 0.14em.
    Columns: User, Email, Rating, Revenue, Status, Joined, Actions (right-aligned).
  - Rows: padding `16px 30px`, bottom border `1px #1e1810`; hover bg `#181209`.
    - **User cell**: 42px avatar circle with initials (active: bg `#1c1810`, border
      `1px #3a2f1c`, text `#c5a059`; inactive: bg `#17140f`, border `1px #2a2621`, text
      `#6f695f`) + name (`#ece4d4` 14.5/600) + handle (`#c5a059` 12.5px). *(Prototype uses
      initials avatars; in the app keep the existing `ProfileImage` component and just restyle
      the ring/fallback to these values.)*
    - **Email**: 13.5px `#9a9488`, ellipsis.
    - **Rating**: numeric (13px/600 `#d7d0c3`, tabular) above a row of 5 star icons (13px);
      filled `#c5a059`, empty `#3a342c`. Filled count = round(rating).
    - **Revenue**: Schibsted 15px/600 `#f4eede`, tabular.
    - **Status**: pill tag, height 26px, radius 20px, padding `0 12px`, 11.5px/600. Active =
      green tokens; Invited = gold tokens (see Design Tokens).
    - **Joined**: 13px `#8f887c`, tabular (format `YYYY / MM / DD`).
    - **Actions** (right-aligned): two 34px icon buttons (radius 9px, border `1px #2c2419`,
      bg `#191309`, icon `#b0a894`). Availabilities hover: border `#c5a059`, bg `#211a10`.
      Delete hover: border `#a5563f`, bg `#211210`.
  - **Pagination** (padding `18px 30px`, right-aligned): prev circle (34px, border `1px #2c2419`,
    text `#6f695f`) + "Page 1 / 2" (13px `#8f887c`, current in `#ece4d4`/600) + next circle
    (border `1px #3a2f1c`, bg `#1a140b`, gold `›`; hover bg `#241b0f`).

### 4. Login — `pages/Login` + `ui/Hero`, `ui/SidePanel`, `common/Card`, `common/Form`, `common/Input`
Two-column grid `1.05fr 1fr`, full height.
- **Left panel**: padding `64px 60px`, centered column, bg
  `radial-gradient(120% 90% at 15% 10%, #1c1610 0%, #0e0b07 60%)`, right border `1px #241d13`.
  Decorative gold glow: 340px circle top-left, `radial-gradient(circle, rgba(197,160,89,.16), transparent 65%)`.
  Content (max-width 440px): eyebrow "WELCOME BACK" (gold) → H1 "Log in with just your phone"
  (42px) → subcopy "Your barber, one text away. No passwords, no fuss — the way a good shop
  should feel." (15.5px `#9a9488`) → 3 feature rows (42px rounded-11px icon chips, bg `#1c1810`,
  border `1px #3a2f1c`, gold 20px icons: dial / appointment / review; text `#c9c2b5` 14.5px) →
  note over top border "First time? Just enter your number — your account is created
  automatically." (13px `#6f695f`).
- **Right (login card)**: centered; card max-width 380px, bg
  `linear-gradient(180deg,#161209,#120f08)`, border `1px #2b241a`, radius 18px, padding
  `38px 34px 34px`. H2 "Login" (24px) + hint (13.5px `#8f887c`). Input label UPPERCASE 12px
  `#8f887c`. Phone field: 48px, radius 10px, border `1px #2c2419`, bg `#0f0c07`, placeholder
  `#4a463d`. Gold "Send code" button: 50px, radius 10px, bg `#c5a059`, text `#1a140b`/15px/600;
  hover `#d4b171`. Below: staff-login toggle link (13.5px `#8f887c`, underline `#3a342c`;
  hover `#c5a059`).
  *(The real Login has three form states — client OTP request, OTP verify, staff email/password
  — plus `color="gold"` buttons. Keep all existing logic; only restyle to the values above.)*

---

## Interactions & Behavior
- **Sidebar nav** switches the active route; active item gets the gold background treatment
  (existing `.active` class in `Sidebar.module.scss` — change its bg from `$color-accent` to
  `#c5a059` and ensure text/icon become `#1a140b`).
- **Sidebar collapse** toggles width 266px ⇄ 78px with `.25s cubic-bezier(.4,.05,.2,1)`;
  labels hide when collapsed (existing behavior — keep).
- **Hover states**: all listed above; transitions ~0.15–0.2s ease on background/border/color.
- **Refresh barbers** shows a spinner + "Refreshing…" (existing logic — keep).
- **Invite / Delete** open existing modals — restyle modal surfaces to `#161209→#120f08`
  panel tokens, borders `#2b241a`, gold primary action buttons.
- No new state or data-fetching is introduced; this is styling only.

## State Management
Unchanged. All existing React state, contexts (`AuthContext`, `FormContext`), hooks, and API
calls remain as-is. This handoff touches **styling only** (SCSS variables + a few module edits).

---

## Icons
The design reuses the app's **existing icon set** at `frontend/assets/icons/*.svg`
(no new icons). They are monochrome SVGs. In the prototype they were recolored via CSS mask;
in the React app the existing `Icon` component already renders them inline — just drive their
color to the values above (gold `#c5a059`, muted `#8f887c`/`#8a8172`, dark `#1a140b` on gold,
faint `#5f5849`) instead of the current white/`black`-invert approach. Icons used: dashboard,
barber, client, appointment, settings, revenue, completed, calendar, cancelled, review, rating,
user, email_base, refresh, spinner, check, plus, availability, trash, menu, scissors, dial,
github, docs, bug, barbermanager (logo).

The `barbermanager.svg` logo mark is used as-is (light rounded-square crest) in the header.

---

## Per-component notes (files to edit in the real codebase)
Almost everything flows from the two style files; these components need small direct edits:

- `styles/variables.module.scss` — **primary change.** Update palette + add new surface/text/
  border/tag tokens (see Design Tokens).
- `styles/global.scss` — swap font import + `$font-heading`/`$font-body`; `h1,h2` now use the
  sans heading font (drop the serif rule, or keep pointing at `$font-heading`).
- `components/ui/StatCard/StatCard.module.scss` — card bg → gradient + border `#29221a`; the
  `.label` currently uses `border-bottom` + `$color-main` on light — change to UPPERCASE muted
  label, remove the light divider (or make it `#241d13`), value color `#f4eede`. Icon chip bg
  stays gold-family `#211a10` with gold icon (remove the `black` invert on the icon).
- `components/common/Card/Card.module.scss` — dark surface tokens.
- `components/common/Pagination/*` — table header/rows/hover/pagination per Screen 3.
- `components/common/Tag/Tag.module.scss` — remap green/yellow to the dark-friendly tag tokens.
- `components/common/Button/Button.module.scss` — `primary`, `gold`, `secondary`,
  `transdark`, `borderless`, `link` color variants to the button values above.
- `components/common/Input/*` — field bg `#0f0c07`, border `#2c2419`, radius 10px, text ivory,
  placeholder `#4a463d`.
- `components/layout/{Header,Sidebar,Footer}/*.module.scss` — chrome values per Screen 1.
- `pages/Login/Login.module.scss` + `ui/Hero`, `ui/SidePanel` — per Screen 4 (gold glow, panel gradient).
- `ui/RadialChart/*` — ring `conic-gradient(#c5a059 …, #2a231a 0)`, inner `#141109`, text `#f4eede`.
- `ui/Rating/*` — filled star `#c5a059`, empty `#3a342c`.
- `ui/Profile/ProfileImage` — avatar ring/fallback per User cell values.

Because the codebase already centralizes color in `variables.module.scss`, start there and
recompile — many screens will update automatically. Then walk the component list above for the
spots that hard-code light values or use the old `black` icon-invert.

---

## Files in this bundle
- `BarberManager.dc.html` — the high-fidelity prototype (all four views: Dashboard, Barbers,
  Login, plus the shared chrome and empty-state pattern). **Source of truth for appearance.**
- `icons.js` — the icon set baked as data-URI mask values (used only by the prototype;
  you do **not** need this in the app — use the app's existing `assets/icons/*.svg`).
- `icons/` — copies of the source SVG icons used by the prototype (same files already in
  `frontend/assets/icons/`).

Open `BarberManager.dc.html` in a browser to inspect exact rendering. Use the sidebar to switch
between Dashboard and Barbers; the header "Logout" button reveals the Login screen, "Log in"
returns to the app.
