# FPL Hub — Design System & UI Specification

> A Fantasy Premier League analytical hub that treats data as the primary interface. Google-inspired clarity meets sports analytics edge — clean surfaces, semantic colour, and zero decoration that doesn't earn its place.

---

## 1. Design Philosophy

**Data-first, opinion-second.** Every pixel serves the numbers. The UI is a lens, not a frame — it stays out of the way until colour, weight, or position needs to encode meaning. The aesthetic draws from the best of modern analytics platforms (Looker, Grafana, Linear) and Google's Material Design 3 surface/tonal system, while grounding itself firmly in the language of football: pitch greens for context, kit-white cards for content, and a restrained use of Premier League energy without cosplaying as the official app.

**Core principles:**

- **Semantic colour is sacred.** Red means danger (injuries, bad fixtures, price drops, poor form). Green means opportunity (risers, good fixtures, high form, captaincy edge). Amber means caution (watch-list, rotation risk, uncertain). These colours are never used decoratively — if it's green, it's genuinely good.
- **Neutral by default, colour by exception.** 90% of the interface is greyscale surfaces and type. Colour appears only when data demands it — a stat that's changed, a fixture that's hard, a player that's flagged.
- **Hierarchy through typography and spacing, not borders.** Cards are distinguished by surface elevation (subtle shadows, tonal shifts), not outlined boxes. Dense tables breathe through generous row height and alternating tonal rows.
- **Google-inspired, not Google-cloned.** We borrow the M3 surface/tonal architecture (layered neutral surfaces, tonal elevation, rounded containers) but pair it with a sharper typographic personality and a sports-analytics colour vocabulary that goes beyond Material's defaults.

---

## 2. Colour System

### 2.1 Neutrals (The Foundation — 90% of the UI)

The entire interface sits on a warm-cool grey spectrum. Not blue-grey (too corporate), not warm beige (too editorial). A true neutral with the faintest cool undertone, inspired by Looker Studio and Linear's surface system.

| Token                | Hex       | Role                                              |
|----------------------|-----------|----------------------------------------------------|
| `--surface-ground`   | `#F4F5F7` | Page background, app shell                         |
| `--surface-raised`   | `#FFFFFF` | Cards, panels, modals                              |
| `--surface-sunken`   | `#EBEDF0` | Inset areas, table headers, sidebar background     |
| `--surface-overlay`  | `#FFFFFF` | Dropdowns, popovers (with shadow)                  |
| `--border-subtle`    | `#E0E3E8` | Card edges (used sparingly), dividers              |
| `--border-default`   | `#C4C9D1` | Input borders, active dividers                     |
| `--text-primary`     | `#1A1D23` | Headlines, primary data values                     |
| `--text-secondary`   | `#5F6672` | Labels, supporting text, column headers            |
| `--text-tertiary`    | `#9BA1AB` | Placeholders, disabled states, timestamps          |
| `--text-inverse`     | `#FFFFFF` | Text on dark/coloured backgrounds                  |

### 2.2 Semantic Colours (Data Meaning)

These are the workhorses. Every instance of these colours maps to a real-world FPL concept. They are never used for branding or decoration.

#### Status Green — "Good / Opportunity / Rising"

Used for: price risers, easy fixtures (FDR 1–2), high form, positive xG trends, recommended picks, points gains.

| Token                  | Hex       | Usage                                  |
|------------------------|-----------|-----------------------------------------|
| `--semantic-green-600` | `#1B873B` | Primary green — text, icons, badges    |
| `--semantic-green-500` | `#28A745` | Chart lines, progress fills            |
| `--semantic-green-100` | `#DAFBE1` | Light background tint on cards/rows    |
| `--semantic-green-50`  | `#EFF8F1` | Subtle row highlight                   |

#### Status Red — "Bad / Danger / Falling"

Used for: price fallers, hard fixtures (FDR 4–5), injuries, suspensions, poor form, points losses.

| Token                | Hex       | Usage                                    |
|----------------------|-----------|--------------------------------------------|
| `--semantic-red-600` | `#CF222E` | Primary red — text, icons, badges        |
| `--semantic-red-500` | `#DC3545` | Chart lines, alert fills                 |
| `--semantic-red-100` | `#FFCECB` | Light background tint on cards/rows      |
| `--semantic-red-50`  | `#FFF0EE` | Subtle row highlight                     |

#### Status Amber — "Caution / Watch / Neutral-Negative"

Used for: rotation risk, price-watch (uncertain direction), moderate fixtures (FDR 3), yellow flags, bench players.

| Token                  | Hex       | Usage                                   |
|------------------------|-----------|--------------------------------------------|
| `--semantic-amber-600` | `#BF8700` | Primary amber — text, icons             |
| `--semantic-amber-500` | `#E8A317` | Chart elements, warning badges          |
| `--semantic-amber-100` | `#FFF4CC` | Light background tint                   |
| `--semantic-amber-50`  | `#FFFBEB` | Subtle row highlight                    |

#### Info Blue — "Neutral / Informational / Interactive"

Used for: links, interactive elements, informational callouts, selected states, ICT index indicators. This is the closest thing to an "accent" but it is not a brand colour — it's the informational semantic.

| Token                 | Hex       | Usage                                    |
|-----------------------|-----------|--------------------------------------------|
| `--semantic-blue-600` | `#1971C2` | Primary blue — links, active states      |
| `--semantic-blue-500` | `#2196F3` | Chart accents, selection highlights      |
| `--semantic-blue-100` | `#D0EBFF` | Light background tint                    |
| `--semantic-blue-50`  | `#E7F5FF` | Subtle row/card highlight                |

### 2.3 Data Visualisation Palette (Charts & Graphs)

For multi-series charts (e.g. comparing 3+ players, gameweek-by-gameweek lines), we need a categorical palette that is colourblind-safe and doesn't collide with semantic colours. This 6-colour sequence is derived from the Tableau/D3 school of perceptually distinct hues, tuned to sit well on our neutral surfaces.

| Index | Name      | Hex       | Use case example                           |
|-------|-----------|-----------|--------------------------------------------|
| 1     | Steel     | `#4C72B0` | Primary data series, "your team"           |
| 2     | Tangerine | `#DD8452` | Secondary comparison, league average       |
| 3     | Sage      | `#55A868` | Third series (avoid if green = semantic)   |
| 4     | Coral     | `#C44E52` | Fourth series (avoid if red = semantic)    |
| 5     | Mauve     | `#8172B3` | Fifth series, differentials                |
| 6     | Sand      | `#CCB974` | Sixth series, historical/benchmark         |

**Rule:** In any chart where green/red already carries semantic meaning (e.g. fixture difficulty), do not use Sage or Coral as data series. Fall back to Steel, Tangerine, Mauve, Sand.

### 2.4 Fixture Difficulty Rating (FDR) Scale

The FDR ticker is one of the most-viewed components. It needs its own dedicated 5-step scale that reads instantly.

| FDR | Label          | Background   | Text         |
|-----|----------------|--------------|--------------|
| 1   | Very Easy      | `#DAFBE1`    | `#1B873B`    |
| 2   | Easy           | `#C3F7CB`    | `#1B873B`    |
| 3   | Medium         | `#FFF4CC`    | `#BF8700`    |
| 4   | Hard           | `#FFCECB`    | `#CF222E`    |
| 5   | Very Hard      | `#F8B4B4`    | `#9E1B1B`    |

### 2.5 What We Avoid

- **Purple / violet accents** — reads as "AI product" (Anthropic, OpenAI, Gemini all lean purple). We have zero purple in the core palette.
- **Premier League official purple (#37003C)** — we are not the official app.
- **Neon / electric accents** — too gamified, undermines analytical trust.
- **Gradients on data elements** — gradients obscure precise colour-to-meaning mapping. Flat fills only on charts and badges.

---

## 3. Typography

### 3.1 Type Stack

| Role        | Family                   | Weight        | Tracking | Usage                                              |
|-------------|--------------------------|---------------|----------|------------------------------------------------------|
| Display     | **Inter**                | 700 (Bold)    | -0.02em  | Page titles, hero stat numbers, captain card name   |
| Heading     | **Inter**                | 600 (Semi)    | -0.01em  | Section headings, card titles                       |
| Body        | **Inter**                | 400 (Regular) | 0        | Paragraph text, descriptions, tooltips              |
| Data        | **JetBrains Mono**       | 500 (Medium)  | 0        | Stat values, prices, xG numbers, table cells        |
| Label       | **Inter**                | 500 (Medium)  | 0.03em   | Column headers, badge text, small caps labels       |

**Why Inter?** It's the closest open-source typeface to Google's Product Sans / Google Sans aesthetic: geometric, highly legible at small sizes, excellent tabular figures, and native variable font support for precise weight control. It reads as modern-analytical without being cold.

**Why JetBrains Mono for data?** Monospaced figures are critical for scanning columns of numbers. JetBrains Mono has distinctive character shapes that prevent digit confusion (1 vs l, 0 vs O) — essential when you're comparing £5.1m vs £5.7m at a glance. It also gives the data a subtle "terminal" feel that signals precision.

### 3.2 Type Scale

| Token          | Size   | Line Height | Usage                                |
|----------------|--------|-------------|---------------------------------------|
| `--text-xs`    | 11px   | 16px        | Timestamps, fine print               |
| `--text-sm`    | 13px   | 18px        | Labels, badges, table headers        |
| `--text-base`  | 15px   | 22px        | Body text, table cells               |
| `--text-lg`    | 18px   | 26px        | Card titles, section subheads        |
| `--text-xl`    | 22px   | 28px        | Page headings                        |
| `--text-2xl`   | 28px   | 34px        | Hero stats, captain pick name        |
| `--text-3xl`   | 36px   | 42px        | Dashboard headline numbers           |

---

## 4. Spacing & Layout

### 4.1 Spatial Scale

Base unit: **4px**. All spacing derives from this.

| Token      | Value | Usage                                         |
|------------|-------|------------------------------------------------|
| `--sp-1`   | 4px   | Icon-to-text gap, inline padding              |
| `--sp-2`   | 8px   | Tight internal padding, badge padding         |
| `--sp-3`   | 12px  | Default internal card padding                 |
| `--sp-4`   | 16px  | Card padding, column gaps                     |
| `--sp-5`   | 20px  | Section internal spacing                      |
| `--sp-6`   | 24px  | Card-to-card gap, row group spacing           |
| `--sp-8`   | 32px  | Section-to-section spacing                    |
| `--sp-10`  | 40px  | Major layout divisions                        |
| `--sp-12`  | 48px  | Page-level vertical rhythm                    |

### 4.2 Grid System

- **App shell:** Fixed sidebar (256px collapsed to 64px) + fluid content area.
- **Content area:** 12-column grid, `--sp-6` (24px) gutters, max-width `1280px`, centred.
- **Dashboard cards:** Span 3, 4, 6, or 12 columns depending on content density.
- **Tables:** Full-width within their container, horizontal scroll on mobile.
- **Breakpoints:** `640px` (mobile), `768px` (tablet), `1024px` (desktop), `1280px` (wide).

### 4.3 Elevation & Depth

No hard borders. Depth is communicated through shadow and tonal shift, following Material 3 tonal elevation principles.

| Level | Shadow                                          | Usage                          |
|-------|--------------------------------------------------|--------------------------------|
| 0     | None                                             | Flush with surface             |
| 1     | `0 1px 3px rgba(0,0,0,0.08)`                    | Cards, raised panels           |
| 2     | `0 4px 12px rgba(0,0,0,0.10)`                   | Dropdowns, popovers            |
| 3     | `0 8px 24px rgba(0,0,0,0.14)`                   | Modals, dialogs                |

### 4.4 Border Radius

| Token               | Value | Usage                          |
|----------------------|-------|--------------------------------|
| `--radius-sm`        | 6px   | Badges, chips, small buttons   |
| `--radius-md`        | 10px  | Cards, inputs, dropdowns       |
| `--radius-lg`        | 14px  | Modals, hero cards             |
| `--radius-full`      | 9999px| Avatars, circular indicators   |

---

## 5. Iconography

- **Library:** Lucide React (open-source, consistent 24px grid, 1.5px stroke).
- **Size tokens:** `16px` (inline/badges), `20px` (buttons/nav), `24px` (section headers).
- **Colour:** Icons inherit `--text-secondary` by default. Semantic icons (injury, price rise, alert) use their respective semantic colour.
- **Custom icons:** FDR shield badges and chip icons (Wildcard, Free Hit, Bench Boost, Triple Captain) are custom SVGs following the Lucide stroke/grid conventions.

---

## 6. Component Library

### 6.1 Stat Card

The fundamental building block of the Dashboard.

```
┌─────────────────────────────┐
│  ↗  Price Risers      •••   │  ← Label (--text-sm, --text-secondary)
│                             │     + contextual icon (semantic colour)
│        23                   │  ← Hero number (--text-3xl, JetBrains Mono, --text-primary)
│                             │
│  +4 from yesterday          │  ← Delta (--text-sm, semantic green/red)
│  Updated 2h ago             │  ← Timestamp (--text-xs, --text-tertiary)
└─────────────────────────────┘
```

- Background: `--surface-raised`
- Padding: `--sp-5`
- Radius: `--radius-md`
- Shadow: Level 1
- Delta text uses `--semantic-green-600` for positive, `--semantic-red-600` for negative, `--text-tertiary` for zero change.

### 6.2 Player Row (Player Explorer Table)

```
┌──────┬────────────────────┬──────┬──────┬──────┬──────┬──────┬──────┐
│ Pos  │ Player             │ Team │ £    │ Form │ xG   │ Own% │  Pts │
├──────┼────────────────────┼──────┼──────┼──────┼──────┼──────┼──────┤
│ FWD  │ ★ Haaland          │ MCI  │ 14.2 │ 8.4  │ 1.21 │ 85%  │ 156  │
│      │ ▼ Expand for detail │      │      │ ▲    │      │      │ ▲    │
└──────┴────────────────────┴──────┴──────┴──────┴──────┴──────┴──────┘
```

- Row height: `48px` (comfortable scan density).
- Alternating rows: `--surface-raised` / `--surface-ground`.
- Form column: colour-coded inline — high form (≥6) in `--semantic-green-600`, mid (3–5.9) in `--text-primary`, low (<3) in `--semantic-red-600`.
- Price column: JetBrains Mono, right-aligned.
- Expanded row: slides down with a `200ms ease` transition, showing a detail panel with ICT breakdown bar chart, fixture ticker (next 5), and ownership trend sparkline.
- Sticky header row on scroll.

### 6.3 Fixture Difficulty Ticker

A horizontal scrollable row of team badges, each followed by 5–6 coloured cells representing upcoming gameweek difficulty.

```
┌───────┬─────┬─────┬─────┬─────┬─────┐
│  ARS  │ GW1 │ GW2 │ GW3 │ GW4 │ GW5 │
│  [badge]│ 2  │  4  │  1  │  3  │  5  │
│       │ grn │ red │ grn │ amb │ dkr │
└───────┴─────┴─────┴─────┴─────┴─────┘
```

- Each cell: `36×36px`, rounded `--radius-sm`, coloured per FDR scale (§2.4).
- FDR number centred in cell, using the corresponding text colour from the FDR table.
- Team column: badge (20px) + short name, sticky on horizontal scroll.

### 6.4 Captain Hero Card (Captain & Chips screen)

The #1 captain recommendation gets a hero treatment.

```
┌─────────────────────────────────────────────┐
│                                             │
│   👑  CAPTAIN PICK — GW24                   │
│                                             │
│   ┌──────────┐                              │
│   │  Player   │   Erling Haaland            │
│   │  Photo    │   Man City • FWD • £14.2m   │
│   │          │                              │
│   └──────────┘   xPts: 9.4                  │
│                   vs BOU (H) — FDR 2        │
│                                             │
│   Form: 8.4 │ xG/90: 0.81 │ Owned: 85.2%  │
│                                             │
│   "Highest ceiling pick this week.          │
│    Home fixture, set-piece taker,           │
│    double-digit haul in 3 of last 5."       │
│                                             │
└─────────────────────────────────────────────┘
```

- Background: `--surface-raised` with a very subtle left-border accent in `--semantic-green-600` (3px solid).
- Crown icon: `--semantic-amber-500` (gold).
- xPts number: `--text-2xl`, JetBrains Mono, `--semantic-green-600`.
- FDR badge inline: coloured per scale.
- Radius: `--radius-lg`.
- Shadow: Level 1, slightly elevated.

### 6.5 Pitch View (Team Analyser)

A simplified pitch graphic showing the user's 15-man squad in formation.

- Pitch background: `#2D8A4E` (muted grass green) with subtle lighter stripe pattern at 10% opacity.
- Player nodes: circular (`48px`), white background, player web name inside, position-coloured ring (GKP: `--semantic-amber-500`, DEF: `--semantic-blue-500`, MID: `--semantic-green-500`, FWD: `--semantic-red-500`).
- Flagged players: node gets a small badge overlay (injury cross in red, yellow triangle for rotation risk).
- Bench row: separated below the pitch, slightly desaturated.

### 6.6 Transfer Suggestion Card (Transfer Hub)

```
┌────────────────────────────────────────────────────┐
│  OUT                          →   IN               │
│  ┌────────┐                       ┌────────┐       │
│  │ Rashford│  £6.8m   Poor form   │ Mbeumo │ £7.1m │
│  │  2.1 F  │  FDR: 5,4,4          │  6.8 F │ FDR: 2,1,3 │
│  └────────┘                       └────────┘       │
│                                                    │
│  Net cost: +£0.3m    xPts gain: +4.2 (next 5 GWs) │
└────────────────────────────────────────────────────┘
```

- Two-column layout: OUT player on left (tinted `--semantic-red-50`), IN player on right (tinted `--semantic-green-50`).
- Arrow icon between: `--text-tertiary`.
- Net cost and xPts gain in footer: JetBrains Mono, semantic colours.

### 6.7 Sidebar Navigation

```
┌─────────────────────┐
│   ⚽ FPL Hub         │  ← App name + logo mark
│                     │
│   📊 Dashboard       │  ← Active: --semantic-blue-600 text,
│   🔍 Player Explorer │     --semantic-blue-50 background pill
│   👤 Team Analyser   │
│   🔄 Transfer Hub    │  ← Default: --text-secondary
│   👑 Captain & Chips │
│   🏗️ Squad Builder   │
│                     │
│   ─────────────────  │
│   ⚙️ Settings        │
│   GW24 • 3d 14h     │  ← Gameweek countdown, --text-tertiary
└─────────────────────┘
```

- Background: `--surface-sunken`.
- Width: `256px` expanded, `64px` collapsed (icons only).
- Active item: `--semantic-blue-50` background pill with `--semantic-blue-600` text and icon.
- Hover: `--surface-ground` background.
- Transition: `200ms ease` collapse/expand.

---

## 7. Screen-by-Screen Layout

### 7.1 Dashboard

```
┌──────────────────────────────────────────────────────────┐
│  GW24 Dashboard                              [Search 🔍] │
├──────────┬──────────┬──────────┬─────────────────────────┤
│ Stat Card│ Stat Card│ Stat Card│      Stat Card          │
│ Overall  │ GW Avg   │ Top Score│      Your Rank          │
│ Rank     │ Points   │ This GW  │      (if team ID set)   │
├──────────┴──────────┴──────────┴─────────────────────────┤
│                                                          │
│  Captain Picks (Top 3)          │  Price Watch            │
│  ┌─────┐ ┌─────┐ ┌─────┐       │  ▲ Risers  ▼ Fallers   │
│  │ #1  │ │ #2  │ │ #3  │       │  ┌───────────────────┐  │
│  │Hero │ │Card │ │Card │       │  │ Player  ∆%  Target│  │
│  └─────┘ └─────┘ └─────┘       │  │ ...              │  │
│                                 │  └───────────────────┘  │
├─────────────────────────────────┴─────────────────────────┤
│  Fixture Difficulty Ticker (all 20 teams, next 6 GWs)    │
│  ┌───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┐ →scroll  │
│  │ARS│AVL│BOU│BRE│BRI│CHE│CRY│EVE│FUL│IPS│...│          │
│  └───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┘          │
└──────────────────────────────────────────────────────────┘
```

### 7.2 Player Explorer

- Full-width data table with fixed first column (player name).
- Filter bar above: position chips (ALL/GKP/DEF/MID/FWD), team dropdown, price range slider, sort dropdown.
- Search input with instant filter.
- Expandable rows for player detail panels.

### 7.3 Team Analyser

- Top: Team ID input bar (persisted in local storage).
- Left column (60%): Pitch view with current squad.
- Right column (40%): GW-by-GW points line chart (Recharts, Steel colour for user, Tangerine for GW average).
- Below: "Weaknesses Detected" alert cards — each one a horizontal card with icon + description + severity badge (red/amber).

### 7.4 Transfer Hub

- Three-tab layout: **Worst Value** | **Replacements** | **Differentials**
- Worst Value: ranked list of squad players by value score (points per £m), lowest first, with red tint.
- Replacements: transfer suggestion cards (§6.6) for each flagged player.
- Differentials: table of low-ownership (<10%), high-xPts players, sortable.
- Sidebar panel: Price Watch list (risers/fallers with % transfer activity).

### 7.5 Captain & Chips

- Hero captain card (§6.4) centred at top.
- Below: ranked list of alternative captain picks (2–5) as compact cards.
- Lower section: "Chip Strategy" — a timeline/calendar view of remaining gameweeks with recommended chip deployment markers (Wildcard, Free Hit, Bench Boost, Triple Captain) on specific GWs, with reasoning tooltips.
- Double/blank gameweek indicators: highlighted rows in the timeline with amber/blue badges.

### 7.6 Squad Builder

- Two modes toggled: **Auto Build** (full 15-man squad) | **Pick & Fill** (lock players, auto-fill rest).
- Left panel: formation selector (4-4-2, 3-5-2, etc.) + budget display (remaining £ in JetBrains Mono).
- Centre: pitch view populating as picks are made.
- Right panel: pick list — each player card shows: name, team, price, xPts (next 5 GWs), and a "Why?" expandable with breakdown (nailedness score, goal/assist probability, fixture run, set-piece duties).
- Bottom bar: total squad value, total xPts, bench strength score.

---

## 8. Interaction & Motion

### 8.1 Motion Tokens

| Token               | Value              | Usage                                 |
|----------------------|--------------------|---------------------------------------|
| `--ease-default`     | `200ms ease`       | Hovers, focus states, colour shifts   |
| `--ease-expand`      | `250ms ease-out`   | Row expansion, panel reveals          |
| `--ease-page`        | `300ms ease-in-out`| Page transitions, modal open/close    |

### 8.2 Interaction Patterns

- **Table row hover:** Background shifts to `--surface-ground` with `--ease-default`.
- **Expandable row:** Click to expand with `--ease-expand`. Chevron icon rotates 180°.
- **Card hover:** Shadow elevates from Level 1 → Level 2 with `--ease-default`.
- **Filter chips:** Active chip filled with `--semantic-blue-100`, inactive outline only. Toggle with `--ease-default`.
- **Sidebar collapse:** Width animates from 256px → 64px with `--ease-page`. Text fades out, icons remain.
- **Pitch view player hover:** Node scales to 1.1× with tooltip showing full player stats.
- **Data loading:** Skeleton screens using `--surface-sunken` shimmer animation (pulse, not sweep — pulse feels more analytical, less consumer-app).

### 8.3 Responsive Behaviour

- **Desktop (≥1024px):** Sidebar always visible. Full grid layout.
- **Tablet (768–1023px):** Sidebar collapsed by default (hamburger toggle). Cards reflow to 2-column.
- **Mobile (<768px):** Sidebar becomes bottom sheet navigation. Cards stack single-column. Tables switch to card-list view. Fixture ticker scrolls horizontally with snap points.

---

## 9. Accessibility

- All text meets **WCAG 2.1 AA** contrast ratios (4.5:1 for body text, 3:1 for large text).
- Semantic colours are **never the sole indicator** — always paired with icons, labels, or patterns (e.g. injury is red cross icon + red text + "Injured" label).
- Colourblind safe: the FDR scale uses brightness/saturation steps that remain distinguishable in deuteranopia and protanopia simulations. Green-600 and Red-600 are verified >3:1 contrast difference in greyscale.
- Focus states: `2px solid --semantic-blue-500` outline with `2px offset` on all interactive elements.
- `prefers-reduced-motion`: all animations collapse to instant state changes.
- Screen reader: all charts include `aria-label` descriptions summarising the data. Table sort controls announce current sort state.

---

## 10. Dark Mode (Future Consideration)

The token system is designed for easy dark mode inversion. When implemented:

| Light Token          | Dark Equivalent     |
|----------------------|---------------------|
| `--surface-ground`   | `#121417`           |
| `--surface-raised`   | `#1E2127`           |
| `--surface-sunken`   | `#0D0F12`           |
| `--text-primary`     | `#E8EAED`           |
| `--text-secondary`   | `#9BA1AB`           |
| `--text-tertiary`    | `#5F6672`           |

Semantic colours shift to slightly lighter/more saturated variants for contrast on dark surfaces (e.g. `--semantic-green-600` → `--semantic-green-400` at `#4ADE80`).

---

## 11. Design References & Inspirations

| Source | What we take from it |
|--------|------|
| **Google Looker Studio** | Surface hierarchy, card-based dashboards, neutral-first palette |
| **Linear** | Typography precision, clean sidebar navigation, monochrome base with semantic accents |
| **Grafana** | Dense data presentation, chart colour discipline, dark-mode-ready token systems |
| **Stripe Dashboard** | Elevation system, spacing rhythm, data table patterns |
| **Material Design 3** | Tonal surface system, rounded containers, semantic colour role architecture |
| **FBref / Understat** | Sports-data table density, stat presentation conventions (xG, xA formatting) |
| **Official FPL App** | Domain vocabulary, FDR scale concept (but we improve the colour clarity) |

---

## 12. Tech Stack Alignment

This design system is built to map cleanly onto:

- **React + TypeScript** (component architecture)
- **Tailwind CSS** (utility-first, extended with custom tokens via `tailwind.config`)
- **Recharts** (chart library, supports custom colour props matching our viz palette)
- **Lucide React** (icon library)
- **Inter** via Google Fonts / `@fontsource/inter`
- **JetBrains Mono** via Google Fonts / `@fontsource/jetbrains-mono`

All colour tokens map to CSS custom properties on `:root`, making theme switching (light/dark) a single class toggle on `<html>`.

---

*Version 1.0 — July 2026*
*Designed for FPL Hub by Dylan*
