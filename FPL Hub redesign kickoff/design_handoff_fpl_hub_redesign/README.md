# Handoff: FPL Hub — light analytics redesign

## Overview

A complete visual redesign of the FPL Analytics Hub (Next.js 14 App Router app, `fpl-analysis/`). The existing app is a dark purple/neon theme (`fpl-purple #37003c`, `fpl-green #00ff87`, `bg-fpl-darker #0d0518`). This redesign replaces that with the light, neutral-first, semantic-colour system specified in `FPL_HUB_DESIGN.md` (bundled) — Google/Looker/Linear-inspired surfaces, Inter + JetBrains Mono, colour reserved for data meaning.

All six existing routes are covered, plus one dark-mode screen, three mobile screens, five empty/loading/error states, and a new **Pick & fill** flow for Squad Builder that did not exist in the app.

**Nothing about the data layer changes.** Every metric, column, algorithm output and copy string maps to what your existing pages and `src/lib/algorithms.ts` already produce (captain score, xPts, FDR runs, price-change confidence, differentials, transfer suggestions, squad-slot breakdowns). This is a presentation-layer task.

## About the design files

`FPL Hub.dc.html` is a **design reference created in HTML** — a prototype showing intended look and behaviour. It is **not production code to copy**. It is a single self-contained file with inline styles and a small vanilla-JS state class; it deliberately does not use React, Tailwind, or your component structure.

The task is to **recreate these designs inside `fpl-analysis/`** using its established environment: Next.js App Router, React + TypeScript, Tailwind CSS with tokens in `tailwind.config.ts`, Recharts for charts, Lucide React for icons. Reuse and extend the existing components (`src/components/Sidebar.tsx`, `StatCard.tsx`, `FDRBadge.tsx`, `LoadingSpinner.tsx`) rather than introducing a parallel system.

Open the HTML file in a browser to navigate it; the left sidebar switches between all screens.

## Fidelity

**High-fidelity.** Final colours, typography, spacing, radii, shadows and copy. Recreate pixel-for-pixel using Tailwind utilities backed by the tokens below. Two intentional exceptions, both marked in the file: **player photos** are diagonal-stripe placeholders, and **team badges** are plain 18×18 rounded squares — supply real assets.

---

## Design tokens

Add these to `tailwind.config.ts` under `theme.extend.colors` (replacing the `fpl` palette) and expose them as CSS custom properties on `:root` so a future dark-mode class toggle is a single switch.

### Neutrals
| Token | Hex | Role |
|---|---|---|
| `surface-ground` | `#F4F5F7` | page background, app shell, header bar |
| `surface-raised` | `#FFFFFF` | cards, panels, table body |
| `surface-sunken` | `#EBEDF0` | sidebar, table header row, segmented control track |
| `border-subtle` | `#E0E3E8` | card edges, dividers, header underline |
| `border-default` | `#C4C9D1` | input borders, dashed placeholders |
| `text-primary` | `#1A1D23` | headings, data values, primary buttons |
| `text-secondary` | `#5F6672` | labels, supporting copy, column headers |
| `text-tertiary` | `#9BA1AB` | placeholders, timestamps, disabled |

Two additional greys are used for zebra rows and skeletons: row tint `#FAFBFC`, row divider `#F1F2F4`, skeleton block `#EBEDF0` / `#E4E7EB`.

### Semantic
| | 600 (text/icon) | 500 (fills) | 100 (tint) | 50 (row tint) |
|---|---|---|---|---|
| green | `#1B873B` | `#28A745` | `#DAFBE1` | `#EFF8F1` |
| red | `#CF222E` | `#DC3545` | `#FFCECB` | `#FFF0EE` |
| amber | `#BF8700` | `#E8A317` | `#FFF4CC` | `#FFFBEB` |
| blue | `#1971C2` | `#2196F3` | `#D0EBFF` | `#E7F5FF` |

Rule: these are never decorative. Green = good/rising/easy, red = bad/falling/hard, amber = caution, blue = informational/interactive/selected.

### Data-viz series (charts, progress bars)
`steel #4C72B0` · `tangerine #DD8452` · `sage #55A868` · `coral #C44E52` · `mauve #8172B3` · `sand #CCB974`

Only steel / tangerine / mauve / sand are used in this design, because green and red are carrying semantic meaning on the same screens. Keep that rule.

### FDR scale (5 steps, background / text)
| FDR | bg | text |
|---|---|---|
| 1 Very easy | `#DAFBE1` | `#1B873B` |
| 2 Easy | `#C3F7CB` | `#1B873B` |
| 3 Medium | `#FFF4CC` | `#BF8700` |
| 4 Hard | `#FFCECB` | `#CF222E` |
| 5 Very hard | `#F8B4B4` | `#9E1B1B` |

Dark-mode FDR equivalents (used on the dark screen): 1 `#14532D`/`#86EFAC`, 2 `#166534`/`#BBF7D0`, 3 `#713F12`/`#FDE68A`, 4 `#7F1D1D`/`#FCA5A5`, 5 `#991B1B`/`#FECACA`.

### Position ring / chip colours
GKP `#E8A317` · DEF `#2196F3` · MID `#28A745` · FWD `#DC3545`.
Position chips in tables use tint/text pairs: GKP `#FFF4CC`/`#BF8700`, DEF `#E7F5FF`/`#1971C2`, MID `#EFF8F1`/`#1B873B`, FWD `#FFF0EE`/`#CF222E`.

### Pitch
Base `#2D8A4E` with `repeating-linear-gradient(90deg, rgba(255,255,255,.07) 0 44px, transparent 44px 88px)` for mown stripes (30px/60px on mobile). No border.

### Typography
- **Inter** — 400 body, 500 labels, 600 headings/names, 700 display. Google Fonts.
- **JetBrains Mono** — 500 for every number: prices, xPts, form, ranks, FDR values, percentages, countdowns, gameweek numbers.

| Use | Size / line-height | Weight | Tracking |
|---|---|---|---|
| Hero stat | 36 / 42 | 500 mono | -0.02em |
| Page title | 22 / 28 | 700 Inter | -0.02em |
| Card/section heading | 18 / 26 | 600 Inter | -0.01em |
| Big name (captain, transfer-out) | 28 / 34 and 22 / 28 | 700 Inter | -0.02em / -0.01em |
| Body | 15 / 22 | 400 | 0 |
| Player name in row | 15 | 600 | 0 |
| Secondary / table cell | 13 / 18 | 400–500 | 0 |
| Uppercase micro-label | 11 | 500 | 0.05–0.09em, uppercase |
| Fine print / timestamps | 10–11 / 14–16 | 400 | 0 |

### Spacing, radius, elevation
4px base. Used values: 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 56.
Radius: 5–6px chips/FDR cells/small buttons · 8px inner panels and inputs · 10px cards, pills, buttons · 12–14px hero cards and modals · 50% avatars · 28/36px phone frames.
Shadows: level 1 `0 1px 3px rgba(0,0,0,.08)` on all cards (level 1 at `.06` for nested cards) · level 2 `0 4px 12px rgba(0,0,0,.10)` for dropdowns · level 3 `0 8px 24px rgba(0,0,0,.14)` for the phone frames.
Focus ring: `2px solid #2196F3` at `2px` offset. The search field in its active state uses `1px solid #2196F3` + `0 0 0 3px rgba(33,150,243,.16)`.

### Motion
`200ms ease` for hovers/colour shifts · `250ms ease-out` for row expansion and panel reveals · `300ms ease-in-out` for page/mode transitions. Skeletons: `omPulse 1.6s ease-in-out infinite` (opacity 1 → .45 → 1), staggered 80ms per row. All animation disabled under `prefers-reduced-motion: reduce`.

---

## App shell

Applies to every screen. Replaces `src/app/layout.tsx` + `Sidebar.tsx`.

- Root: `display:flex; min-height:100vh; background:#F4F5F7`.
- **Sidebar**: fixed 256px (`flex:0 0 256px`), `background:#EBEDF0`, `position:sticky; top:0; height:100vh`, padding `20px 12px 16px`. **No collapse behaviour** — the spec's 256→64px collapse was dropped; six destinations don't need it and the space went to the deadline card.
  - Logo row: 32×32 `#1A1D23` rounded-8 tile, white 700/15px "F"; beside it "FPL Hub" 600/15px and "ANALYTICS" 500/10px, `letter-spacing:.09em`, `#9BA1AB`.
  - Nav items: `display:flex; gap:12px; padding:9px 12px; border-radius:8px; font:500 13.5px Inter`, 18px Lucide-weight icon (1.5px stroke). Default text `#5F6672` on transparent; **active** `#E7F5FF` pill with `#1971C2` text and icon; hover `#F4F5F7`.
  - Order: Dashboard · Player Explorer · Team Analyser · Transfer Hub · Captain & Chips · Squad Builder — then a `1px #DDE0E5` divider inset 12px. (The prototype's items below the divider — Dark mode, Mobile, Empty & loading, Design notes — are **prototype navigation only**; do not ship them.)
  - Footer card, pushed down with `flex:1` spacer: `#F4F5F7`, radius 10, padding 12. "GW24 DEADLINE" micro-label, `3d 14h 22m` in 500/15px mono, a 4px progress bar (`#DDE0E5` track, `#1971C2` fill, width = fraction of the gameweek elapsed), and `Sat 7 Feb, 11:30` in 400/11px `#9BA1AB`. Live countdown, ticking to the minute.
- **Main**: `flex:1; min-width:0`.
- **Page header** (per screen): `position:sticky; top:0; z-index:20`, `padding:20px 40px`, `background:#F4F5F7`, `border-bottom:1px solid #E0E3E8`. Left: page title 700/22px + a 400/13px `#5F6672` context line. Right: actions — 36px-high controls, radius 10, `#FFFFFF` + `1px #E0E3E8` for secondary, `#1A1D23` + white text for primary.
- **Content**: `max-width:1280px; margin:0 auto; padding:28px 40px 56px`, vertical stack with 24px gaps.

⚠️ Do **not** put `position:sticky; top:<offset>` on a table header inside a scaled/transformed container — an earlier revision did and the header detached from row 1. Either stick the table header to its own scroll container or leave it in flow (current design leaves it in flow).

---

## Screens

### 1. Dashboard — `src/app/page.tsx`
**Purpose:** the pre-deadline glance. Rank/points context, who to captain, what's about to change price, what's flagged.

Header: "Gameweek 24" + `Rowan Athletic · ID 4127883`. Right: a 260px-min search field (16px Lucide `search`, placeholder "Search players, teams, fixtures") and a "Switch team" secondary button.

**Stat card row** — `grid-template-columns:repeat(4,1fr); gap:24px`. Each: `#FFFFFF`, radius 10, padding 20, shadow 1, `flex-column; gap:10px`:
1. label 500/13px `#5F6672` + optional 16px semantic icon or a 500/11px context value, right-aligned via `justify-content:space-between`
2. hero number 500/36-42px mono, `-0.02em`
3. delta line 500/13px in green/red/`#5F6672`
4. footnote 400/11px `#9BA1AB`

Contents: Overall rank `142,308` / `▲ 18,442 places this GW` / "Updated 2h ago" (green, with a 16px arrow-up-right) · GW24 points `68` / `+17 vs gameweek average` / "1 transfer · 0 pts hit" (context "avg 51") · Squad value `£102.4m` / `+£2.4m since GW1` / "2 risers held, 1 faller" (context "ITB £0.8m") · Season total `1,384` / `57.7 points per gameweek` / "Top 3% of all managers" (context "24 GWs").

**Two-column band** — `grid-template-columns:1.35fr 1fr; gap:24px; align-items:start`.

*Left — Captain shortlist.* Section heading 600/18px + right-aligned note "Weighted on form, fixture, xG and minutes".
- **Captain hero card**: `#FFFFFF`, radius 14, `border-left:3px solid #1B873B`, padding `22px 24px`, shadow 1, gap 16.
  - Eyebrow: 16px filled crown in `#E8A317` + "CAPTAIN PICK — GW24" 500/11px `.09em` `#BF8700`.
  - Body: 88×104 photo placeholder (radius 10, `repeating-linear-gradient(135deg,#EBEDF0 0 6px,#F4F5F7 6px 12px)`, caption "player shot" 400/9px mono bottom-centred) · name 700/28-34px · `Man City · FWD · £14.2m` 400/15px `#5F6672` · three fixture chips (52×36, radius 6, FDR-coloured, FDR digit 500/14px mono centred, caption `BOU (H)` 500/10px `#5F6672` beneath) · far right, xPts `9.4` 500/28-34px `#1B873B` over "XPTS" micro-label.
  - Stat strip above a `1px #E0E3E8` top border, 28px gaps: Form `8.4` (green), xG/90 `0.81`, PPG `7.1`, Owned `85.2%` — each micro-label + 500/15px mono.
  - Reasoning paragraph 400/15-22px, `max-width:56ch`.
- **Alternatives list**: one `#FFFFFF` radius-10 card; rows separated by `1px #EBEDF0`, `padding:12px 20px`, gap 14. Rank digit (16px, mono `#9BA1AB`) · 170px name block (600/15px + `ARS · MID · £10.6m` 400/11px) · flexible score bar (6px track `#EBEDF0`, fill `#4C72B0`, width = score/100) with xPts 500/13px right of it · three 36×28 FDR chips showing opponent 500/10px mono over H/A 400/8px at 75% opacity.
  Rows: Saka 7.1 (81) · Palmer 6.8 (76) · Salah 6.5 (74) · Isak 6.2 (66).

*Right — Price watch.* Heading + "Tonight, 01:30". One card, padding `18px 20px`, gap 12:
- "LIKELY RISERS" 500/11px `.09em` green with a 14px filled up-triangle; five rows: 118px name block (600/13px + `BRE · £7.1m` 400/11px `#9BA1AB`), net transfers 500/12px mono green, 56px confidence bar (`#EBEDF0` track, `#28A745` fill), percentage 500/11px mono `#5F6672`.
  Mbeumo +142,380 (92%) · Gordon +98,104 (78%) · Rogers +71,652 (64%) · Wood +55,410 (51%) · Kluivert +40,228 (38%).
- `1px #EBEDF0` divider, then "LIKELY FALLERS" in red with a down-triangle and `#DC3545` bars: Rashford −121,904 (88%) · Havertz −87,340 (71%) · Solanke −64,118 (57%) · Foden −52,006 (44%) · Nkunku −38,772 (31%).
- Below the card, a flagged-players alert: `#FFF0EE`, radius 10, padding `16px 18px`, 18px `alert-circle` in `#CF222E`, "2 squad players flagged" 600/13px red, detail 400/13px `#5F6672`, and a `#1971C2` "Review squad →" link routing to Team Analyser.

**FDR ticker** — heading "Fixture difficulty — next 6" with an inline legend: "Easier", five 22×10 swatches in FDR order, "Harder".
Card radius 10, shadow 1, `overflow:hidden`. Grid `88px repeat(6,1fr) 72px`:
- Header row: `#EBEDF0`, `padding:10px 20px`, micro-labels; GW columns centred, "Avg" right.
- 20 team rows, `padding:5px 20px`, `border-top:1px solid #F4F5F7`. Team cell: 18×18 badge placeholder + short name 600/13px. Each fixture cell 62×34, radius 6, FDR-coloured, opponent 500/11px mono over `H · 2` 400/9px at 75% opacity, centred in its column. Avg column: 500/13px mono, green under 2.6, red over 3.4, else `#5F6672`.
- Horizontal scroll with the team column sticky at ≤1023px.

**Deviation from spec worth keeping:** the spec called for 36×36 numeric FDR cells. These are 62×34 and carry opponent + venue + rating, because "who do they play" is the actual question. Numeric-only cells remain in the Player Explorer table where space is tight.

### 2. Player Explorer — `src/app/players/page.tsx`
Header: title + `642 players · 12 shown`; actions "Compare (2)" (secondary) and "Export CSV" (primary).

**Filter card** (`#FFFFFF`, radius 10, padding `16px 20px`, gap 14), two rows:
1. "POSITION" micro-label, then five 30px-high chips, radius 6: active `#D0EBFF`/`#1971C2` with no border, inactive `#FFFFFF` + `1px #E0E3E8` + `#5F6672`. Then a `1px #E0E3E8` 24px-tall divider and a 32px search field (220px min).
2. Team select, sort select (both 32px, radius 8, `1px #E0E3E8`, 12px chevron), a price-range control (label + `£4.0 – £15.0m` in mono + an 88×4 track with a `#2196F3` selected span), and an "Available only" toggle rendered as an `#EFF8F1`/`#1B873B` pill with a 13px check.

**Table** — one card, `overflow:hidden`. Grid columns: `56px 168px 76px 62px 56px 62px 62px 62px 66px 62px 1fr`.
- Header: `#EBEDF0`, 40px tall, `padding:0 20px`, micro-labels; numeric columns right-aligned; the sorted column is `#1971C2` with a `▼`. Left in normal flow (see the sticky warning above); if you make it sticky, scope it to the table's own scroll container.
- Rows: 48px, `border-top:1px solid #F1F2F4`, zebra `#FFFFFF` / `#FAFBFC`, hover `#F4F5F7`, cursor pointer.
  Cells: position chip (`padding:2px 7px`, radius 6, 500/10px, tint/text per position) · status dot (7px circle: `#1B873B` available, `#BF8700` doubtful, `#CF222E` injured, `title` = status label) + name 600/15px (ellipsis) + team 400/12px `#9BA1AB` · **Pts 700/15px mono** · then price, form, PPG, xG, xA, ICT, Own all 500/13px mono `#5F6672`, right-aligned. Form is colour-coded: ≥6 `#1B873B`, <3 `#CF222E`, else `#1A1D23`. Last column: five 30×26 radius-5 FDR chips, numeric only, right-aligned, `title` = `BOU (H)`.
  Twelve rows, sorted by total points: Haaland, Salah, Palmer, Saka, Isak, Mbeumo, Gabriel, Kerkez, Rogers, Wood (doubtful), Raya, Rashford (injured) — exact values in the HTML.
- **Expanded row** (Haaland shown open; `250ms ease-out` slide, chevron rotates 180°): `padding:22px 20px 24px`, `background:#F4F5F7`, `border-top:1px solid #E0E3E8`, three equal columns, 32px gaps.
  1. *ICT breakdown* — 66px label, 8px bar (`#E0E3E8` track), value 500/13px mono right. Influence 1042.6 steel 88% · Creativity 486.2 tangerine 41% · Threat 1594.0 mauve 96%. Below a `1px #E0E3E8` divider: Goals 19, Assists 4, Bonus 27, Starts 22 as micro-label + 500/18px mono.
  2. *Ownership trend · 12 GW* — nested white card, radius 8, padding 14, shadow `.06`: a 290×50 SVG polyline, `#4C72B0`, 2px, `stroke-linejoin:round`, `preserveAspectRatio:none`, height 60. Caption row "GW13 · 78.0%" `#9BA1AB` / "GW24 · 85.2%" green mono. Then two half-width tiles: `#EFF8F1` "Transfers in +64,208" green, `#FFF0EE` "Transfers out −11,472" red.
  3. *Next 5 fixtures* — five flex-1 tiles, radius 8, `padding:10px 0`, FDR-coloured, stacked `GW24` 400/10px at 80% / opponent 600/13px / `H · 2` 400/10px. Below a divider: Penalties "1st choice", Corners/IFK "—", xG over/under `+2.58` in green — label/value rows, `justify-content:space-between`.

**Pagination**: "Showing 1–12 of 642" `#5F6672` left; Prev (disabled: `#9BA1AB`, `cursor:not-allowed`), `1 / 26` 500/13px mono, Next.

### 3. Team Analyser — `src/app/team/page.tsx`
Header: title + `Rowan Athletic · Dylan Reeve · ID 4127883`; a team-ID display pill and a "Re-analyse" primary button.

**Six-up stat strip** — `repeat(6,1fr)`, gap 16, cards padding `16px 18px`, micro-label + 500/22-28px mono: Overall pts 1,384 · Overall rank 142,308 · GW24 pts 68 (green) · Squad value £102.4m · Bench pts 8 (amber) · Chips left 4.

**Main band** — `1.4fr 1fr`, gap 24.

*Left, Squad card.* Heading "Squad · GW24" + `3-4-3 · 68 pts`.
- Pitch: white card padding 16, inner pitch radius 8, `padding:22px 16px`, `flex-direction:column-reverse; gap:20px` so GKP renders at the bottom.
- Player node: 74px-wide column — 48px white circle, `3px solid` position-ring colour, `box-shadow:0 1px 3px rgba(0,0,0,.18)`, GW points 500/13px mono inside; name 600/11-14px white centred; `MCI C` 400/9px `rgba(255,255,255,.75)` beneath (captain `C`, vice `V`, flagged `!`). Hover: scale 1.1 with a stat tooltip.
- Rows: Raya · Gabriel, Saliba, Kerkez · Saka, Palmer, Mbeumo, Rogers · Haaland (C, 24 pts), Isak (V), Wood (!).
- Bench, under a `1px #EBEDF0` divider: "BENCH · 8 PTS" micro-label then four flex-1 tiles on `#F4F5F7`, radius 8, `padding:8px 10px` — a 30px circle at 75% opacity with a 2px ring, name 600/12px `#5F6672`, team 400/10px `#9BA1AB`. Sels, Muñoz, Anderson, Kluivert.
- **Points by gameweek** (own card, padding `18px 20px`): title + a three-item legend (65+ green, 45–64 steel, under 45 red). 24 bars in a 132px flex row, gap 5, `border-bottom:1px solid #E0E3E8`, `radius:3px 3px 0 0`, height = pts/max, colour by the legend rule; a dashed `#C4C9D1` average line at the mean; `title` = `GW12 · 63 pts`. Axis labels GW1/GW8/GW16/GW24 in 400/11px mono `#9BA1AB`. In React use Recharts `BarChart` with a `ReferenceLine` for the average.

*Right column.*
- "Weaknesses detected" heading, then one card per issue: radius 10, `padding:16px 18px`, tinted `#FFF0EE` (high) or `#FFFBEB` (watch); title 600/15px in the matching 600 colour, a white severity pill top-right (500/10px uppercase, `.06em`), body 400/13-18px `#5F6672`. Three cards: Rashford dead weight (High) · Triple Arsenal defence, hard GW26 (High) · Muñoz suspended for GW24 (Watch). Severity comes from the existing `weaknesses` logic in `team/page.tsx`; keep the icon+label pairing so colour is never the only signal.
- "Positional strength" card: four label/bar/value rows (34px label, 8px bar, 44px value) — GKP 89 (58%, steel), DEF 318 (74%, steel), MID 507 (96%, green), FWD 470 (88%, green) — plus a 400/13-18px interpretation paragraph.

### 4. Transfer Hub — `src/app/transfers/page.tsx`
Header: title + `1 free transfer · £0.8m in the bank`; a "Horizon: next 5 GW" pill and a "Recalculate" primary button.

**Segmented control** (replaces the old tabs): `#EBEDF0` track, radius 10, `padding:4px`, `width:fit-content`; active segment `#FFFFFF`, radius 7, 600/13px, shadow `0 1px 2px rgba(0,0,0,.08)`; inactive transparent `#5F6672` 500/13px. Segments: Replacements (active) · Worst value · Differentials.

**Transfer suggestion card** — card radius 10, `overflow:hidden`, inner grid `280px 44px 1fr`, stretched:
- *Out* pane, `#FFF0EE`, `padding:18px 20px`, gap 10: "TRANSFER OUT" 500/11px `.09em` red · name 700/22-28px · `MUN · FWD · £6.8m` 400/13px `#5F6672` · Form (red) and PPG as micro-label + 500/15px mono · three 44×30 FDR chips (opponent over `H · 5`) · sell reason 400/13-18px red.
- *Arrow* column, `#FAFBFC`, a centred 20px `arrow-right` in `#9BA1AB`.
- *In* pane, `padding:18px 20px`: "TRANSFER IN" 500/11px `.09em` green, then one row per option — `#EFF8F1`, radius 8, `padding:12px 14px`, grid `158px 88px 1fr 150px`, gap 16: name 600/15px + `BRE · £7.1m · form 6.8` 400/11px · "XPTS GAIN" micro-label + `+4.2` 500/15px mono green · two 6px bars on a `#D8E5DC` track (Value steel, Captain tangerine) with 46px labels · right-aligned white reason tags (`padding:2px 7px`, radius 6, 500/10px `#5F6672`).
- Footer above a `1px #EBEDF0` border, 28px gaps: "Net cost `+£0.3m`", "xPts gain over 5 GW `+4.2`" (green), "Hit required `none`".
- Two cards: Rashford → Mbeumo / Kluivert, and Wood → Isak / Gordon.

**Differentials** — heading "Differentials under 12% owned" + "Ranked by xPts over the next 5 gameweeks"; `repeat(3,1fr)`, gap 16. Each card padding `16px 18px`, gap 10: name 600/15px + `AVL · MID · £5.6m`; ownership pill top-right (`#E7F5FF`, radius 6, 500/11px mono `#1971C2`); xPts (green) and Form as micro-label + 500/18px mono; rationale 400/13-18px `#5F6672`. Six cards: Rogers, Anderson, Kluivert, Sarr, Wissa, Muñoz.

### 5. Captain & Chips — `src/app/captain/page.tsx`
Header: title + `GW24 · deadline in 3d 14h`; right, a "Community pick — Haaland · 41.2%" pill.

**Top band** `1.3fr 1fr`, gap 24.
- Captain hero: same construction as the Dashboard hero at a larger scale — padding 24, photo 104×124, fixture chips 56×38 with the FDR digit at 500/15px, xPts at 500/36-42px green, stat strip of Form / xG/90 / Season pts / Owned at 500/18px mono, 30px gaps.
- Alternatives: one card each (radius 10, `padding:14px 16px`, gap 9) — rank + name 600/15px + `ARS · £10.6m` + xPts 500/15px green on the right; then a score bar with three 34×24 opponent chips; then the reasoning line 400/13-18px `#5F6672`.

**Chip strategy · GW24 to GW38** — heading + "All four chips unused".
- *Timeline card*: 15 equal columns, gap 6. Each column: a 26px marker slot (a chip badge where recommended — `padding:3px 9px`, radius 6, 700/11px white on the chip colour), then a 52px tile, radius 8, `1px` border (chip colour where marked, else `#E0E3E8`), background `#E7F5FF` for doubles, `#FFFBEB` for blanks, else white — gameweek number 500/13px mono over a "DOUBLE"/"BLANK" micro-label. Markers: BB GW28 green, WC GW31 blue, TC GW34 amber, FH GW37 grey.
- *Chip cards*: `repeat(4,1fr)`, gap 16, padding 18 — a 34px rounded-8 tile with the chip code in 700/12px on the chip tint, name 600/15px, target gameweek 500/12px mono in the chip colour, rationale 400/13-18px `#5F6672`. Wildcard GW31 blue · Bench Boost GW28 green · Triple Captain GW34 amber · Free Hit GW37 neutral.

### 6. Squad Builder — `src/app/squad-builder/page.tsx`
Header: title + "Optimal XV within £100.0m"; a segmented **Auto build / Pick & fill** control (30px segments in a `#EBEDF0` track) that switches the whole body.

**Auto build mode** — `grid-template-columns:1fr 400px`, gap 24.
- *Budget card*: "Budget" 600/15px + `Spent £99.6m · Remaining £0.4m` (remaining green, red if negative); a 10px `#EBEDF0` track with a `#4C72B0` fill at spend%; four flex-1 position tiles, radius 8, `padding:9px 12px`, `#EFF8F1`/`#1B873B` when complete (`GKP 2/2`), `#F4F5F7`/`#5F6672` when not.
- *Pitch card*: same pitch treatment as Team Analyser; nodes show the team short name instead of points. Below it, four `#F4F5F7` radius-8 summary tiles: Total xPts `371.4` green · Squad cost `£99.6m` · Bench strength `Fair` amber · Locked picks `0`.
- *Right rail — "Why these picks" / "Top 5 by xPts"*: per player a card (padding `16px 18px`, gap 11) — name 600/15px + `MCI · FWD · £14.2m` + an xPts pill (`#EFF8F1`, radius 6, 500/13px mono green); three 6px bars with 62px labels (Nailed steel, Goal threat tangerine, Fixtures mauve); rationale 400/13-18px.

**Pick & fill mode** (new flow — did not exist in the app). A three-step wizard; the stepper is a row of 34px buttons, radius 8, `1px` border, each with a mono ordinal — active `#1A1D23`/white, inactive `#FFFFFF`/`#5F6672` — separated by 14px chevrons. Steps are freely clickable. Layout below the stepper is again `1fr 400px`.

- **Budget card, steps 1–2**: `Locked £36.8m · For 11 slots £63.2m` (the second value blue); the bar shows a solid `#1A1D23` segment for locks and a diagonally hatched `repeating-linear-gradient(135deg,#D0EBFF 0 5px,#EBEDF0 5px 10px)` remainder. A legend reads "Your locks · 4", "Auto-filled · 11", and right-aligned "Average left per open slot: £5.7m". In step 3 the header becomes `Squad £99.9m · Remaining £0.1m` and the hatched span turns solid `#4C72B0`.
- **Pitch**: three node treatments — *locked* (white fill, `3px solid` ring, team name, plus a 17px `#1A1D23` circle badge with a white padlock at `top:-4px; right:-4px`, name 600/11px); *open* (`rgba(255,255,255,.14)` fill, `2px dashed rgba(255,255,255,.55)`, the position abbreviation inside, caption "open"); *auto-filled* (white fill, `3px dashed` ring, team name in `#5F6672`, name 500/11px at 90% white). Steps 1–2 show locked + open; step 3 shows locked + auto-filled — the dashed ring is what tells you at a glance which players the optimiser chose.
- **Step 1 rail — Search and lock**: intro copy; position chips; a focused search field (`1px #2196F3` + 3px blue glow) containing the query "sa" and a caret; then a results dropdown (`1px #E0E3E8`, radius 8, shadow 2) with rows `padding:9px 12px`, `border-bottom:1px solid #F1F2F4`: 34px position, name 600/13px, team 400/11px, a right-aligned reason string, ownership, price. Row states: normal white · already-locked `#EFF8F1`/`#1B873B` with note "Locked" · **blocked** `#FFFBEB`/`#BF8700` with the reason inline ("3 Arsenal players already"). Blocked players stay visible with an explanation — silently filtering them out reads as a bug. Footnote makes that rule explicit. Below: a "Locked · 4 of 15" card with a "Clear all" link and chips (`#F4F5F7`, radius 8, `border-left:3px solid` position colour, position + name + price + an 18px `×` button).
- **Step 2 rail — constraints**: "Slots to fill" card with four label/bar/value rows (`#1A1D23` fill, `1/2`, `1/5`, `1/5`, `1/3`); "Club limits" card listing each club at or near the 3-player cap (`ARS 3/3` on `#FFFBEB` with "At limit"; `MCI 1/3` neutral) plus a paragraph naming the players the cap now excludes; an `#E7F5FF` explainer card "What the fill will optimise"; and a full-width 42px `#1A1D23` "Fill remaining 11 slots" button.
- **Step 3 rail — result**: "Auto-filled picks · 11 slots" listing every non-locked player (name 600/14px, `LIV · DEF · £5.6m`, xPts 500/13px green, and "Swap" `#1971C2` / "Lock" `#5F6672` chips on `#F4F5F7`); a footnote describing the lock-and-refill loop; then "Edit locks" (secondary) and "Save squad" (primary) side by side.
  Under the pitch, the result summary becomes Total xPts `360.7` · Cost of locks `£36.8m` · Bench strength `Fair` · **vs auto build `−10.7`** in red, followed by an amber `#FFFBEB` card explaining the cost: three Arsenal players block Saliba and force a £4.0m fifth defender; dropping Raya frees £1.2m. **Always show the price of the user's constraints** — this is the whole point of the mode.

The prototype's `pfRows` array is the source of truth for the demo squad: locks are Haaland £14.2m, Saka £10.6m, Gabriel £6.4m, Raya £5.6m (= £36.8m); the fill is Sels 4.4, Kerkez 5.6, Muñoz 5.4, Konsa 4.6, Andersen 4.0, Mbeumo 7.1, Sarr 6.3, Rogers 5.5, Anderson 4.9, Isak 9.4, Kluivert 5.9 (total £99.9m, 360.7 xPts).

---

## Empty, loading and error states

Documented on the prototype's "Empty & loading" screen. Ship all five.

1. **First run — no team connected** (Team Analyser, Transfer Hub, Captain & Chips). A 460px centred card, radius 14, padding 32: a 44px `#E7F5FF` rounded-12 tile with a 22px blue `user` icon; "Connect your FPL team" 700/22px; a 400/15-22px explanation; a 44px input (`1px #C4C9D1`, radius 10, mono placeholder `e.g. 4127883`) beside a 44px `#1A1D23` "Connect" button; a `#F4F5F7` "Where to find it" panel naming the `/entry/` URL segment; and a `#1971C2` "Browse without a team →" link. That escape hatch matters — Dashboard, Player Explorer and the ticker all work with no ID, so don't gate the product behind the input. Persist the ID in `localStorage` under the existing `fpl-team-id` key.
2. **Loading — skeletons.** Mirror the real layout so nothing reflows on arrival: four stat-card skeletons (11px label block, 30px value block, 11px footnote block, on `#EBEDF0`/`#E4E7EB`), a hero-card skeleton keeping the 3px left border in `#E0E3E8`, and a panel of eight rows at varying widths (72/58/66/50/62/44/68/54%). Animate `omPulse 1.6s ease-in-out infinite` (opacity → .45), staggered 80ms per row. **Pulse, not sweep** — a shimmer reads consumer, a pulse reads analytical. Replaces the current `LoadingSpinner` on data screens; keep a spinner only for user-triggered recomputes.
3. **No results.** A filter summary bar (`#EBEDF0`) listing active filters as removable `#D0EBFF` chips with a "Reset all" link, then a 56px-padded centred block: a 40px icon tile, "No goalkeeper matches all three filters" 600/18px, a body line naming the nearest real answer ("The cheapest keeper with form above 6.0 is **Sels at £4.9m**"), and two buttons — the specific loosening ("Raise price to £5.0m", primary) and "Clear form filter". Name the filter that emptied the table and offer the fix; "No players match your filters" makes the user diagnose it themselves.
4. **Upstream failure — stale but usable.** Never a full-page error when cache exists. An `#FFF0EE` banner ("The FPL API isn't responding", cached timestamp in mono, "Retried twice automatically") with a white `1px #F1C0BD` "Retry now" button; cached cards rendered at `opacity:.6` with a "Cached 09:12" footnote; and only genuinely live-dependent panels marked unavailable — Price Watch renders as a `#F4F5F7` card reading "Unavailable / Needs live transfer data", because stale price data is actively harmful.
5. **Pre-season.** A card with a 38px amber clock tile, "No gameweek has been played yet" 600/18px, an honest note that form/ICT/xG are empty and everything shown derives from last season plus the new fixture list, and a right-aligned `11d 04h` countdown to the GW1 deadline. Below: six dashed `1px #C4C9D1` placeholder tiles labelled GW1–GW6 / "not played". Ends in actions — "Open Squad Builder", "View fixture ticker" — because there is real work available. The current `page.tsx` already computes `isPreSeason`; wire it to this.

---

## Dark mode

The prototype includes a full dark Dashboard using the spec's §10 inversion, so the token mapping is proven end to end. Ship it as an `html.dark` class toggle over CSS custom properties — no component changes.

`surface-ground #121417` · `surface-raised #1E2127` · `surface-sunken #0D0F12` · border `#262A31` (subtle) / `#2E333B` (default) · `text-primary #E8EAED` · `text-secondary #9BA1AB` · `text-tertiary #5F6672` · green `#4ADE80` · red `#F87171` · amber `#FBBF24` · blue `#60A5FA` · viz steel `#60A5FA`. FDR pairs as listed in the tokens section. Photo placeholders switch to `repeating-linear-gradient(135deg,#262A31 0 6px,#1A1E24 6px 12px)`.

---

## Responsive

- **≥1024px** — as documented. Sidebar always visible, full grids.
- **768–1023px** — sidebar becomes an overlay behind a hamburger; four-up stat rows become 2×2; the two-column bands stack; tables scroll horizontally with the first column sticky.
- **<768px** — three mobile screens are drawn in the prototype at 390×844:
  - **Bottom tab bar** replaces the sidebar: 4 tabs (Home, Players, Transfers, Captain), 20px icons over 500/10px labels, active tab on an `#E7F5FF` rounded-8 pill with `#1971C2` icon and label. `border-top:1px solid #E0E3E8`, white, `padding:8px 8px 18px` for the home indicator. Every target ≥44px.
  - **Dashboard**: 2×2 stat cards (padding 14, value 500/22px mono), a compact captain hero (700/20px name, xPts 500/20px, three flex-1 32px fixture chips reading `BOU · 2`), the flagged-players alert, and a condensed price-watch list.
  - **Player Explorer**: the table becomes a card list — each card padding `12px 14px`, gap 9: position chip + name 600/15px + team + points 700/15px mono on one line; price, form (colour-coded), ownership and five 20×20 numeric FDR chips on the second. Filters collapse to a search field plus a horizontally scrolling chip row.
  - **Team Analyser**: pitch at 38px nodes with 30px/60px stripes, then the weakness cards stacked.
  - The FDR ticker scrolls horizontally with scroll-snap on the gameweek columns.

---

## State

Per screen, on top of what the existing pages already hold (`bootstrap`, `fixtures`, `loading`, `error`, filter and sort state, `expandedId`, `teamId` in `localStorage`):
- **Squad Builder**: `mode: 'auto' | 'pick'`; in pick mode `step: 1 | 2 | 3` and `lockedPlayers: FPLPlayer[]`. Locking or unlocking clears the built squad and returns to step 1. Derived: locked cost, per-position counts, per-club counts, remaining budget, remaining slots, and the xPts delta against the unconstrained build (needs both `buildOptimalSquad(locked)` and `buildOptimalSquad([])`) to power the "vs auto build" figure.
- **Search dropdown**: `query`, `positionFilter`, `open`, plus per-result eligibility (`ok` | `locked` | `blocked` + reason) so blocked rows can explain themselves — the current implementation filters them out; change that.
- **Data staleness**: cache timestamp and a retry count, to drive state 4. `fpl-client.ts` already caches for 5 minutes; surface `fetchedAt`.
- **Countdown**: a per-minute tick for the deadline card.

## Assets

Nothing binary is included. Two placeholders need real assets:
- **Player photos** — diagonal-stripe blocks captioned "player shot" (88×104 and 104×124 on desktop). The official API exposes photo codes on each element.
- **Team badges** — 18×18 `#EBEDF0` rounded squares in the ticker; 20px per the spec.

Icons are inline SVGs at 1.5px stroke on a 24px grid, matched to Lucide's geometry; the six nav icons are the exact paths from your current `src/components/Sidebar.tsx`. Replace all of them with `lucide-react` imports: `LayoutDashboard`, `Users`, `BarChart3`, `ArrowLeftRight`, `Star`, `LayoutGrid`, `Search`, `ChevronDown`, `ChevronRight`, `ArrowUpRight`, `AlertCircle`, `AlertTriangle`, `Clock`, `Lock`, `Check`, `X`. Chip icons (WC/FH/BB/TC) stay as text codes in coloured tiles — no custom art needed.

Fonts: `Inter` 400/500/600/700 and `JetBrains Mono` 400/500/700 via `next/font/google` (preferred over the current `@import` in `globals.css`).

## Files

- `FPL Hub.dc.html` — the design reference. All screens; the left sidebar switches between them. Sidebar items below the divider (Dark mode, Mobile, Empty & loading, Design notes) are prototype navigation, not product features.
- `FPL_HUB_DESIGN.md` — the underlying design system spec (tokens, principles, component rules). Where this README and the spec differ, the README is the newer decision; the differences are deliberate and listed on the prototype's "Design notes" screen.

## Data note

Every figure is a plausible mid-season GW24 placeholder, not a real API response. Layouts are built for the real shapes — 20 teams × 6 gameweeks, 640+ players, 15-man squads, 38 gameweeks — so live data drops straight in. Watch two things: long player names (rows use ellipsis, not wrapping) and double gameweeks (the ticker must render two fixture chips in one gameweek cell, as the current `FixtureRunRow` already handles).
