# FPL Analytics Hub

Advanced data analytics dashboard for Fantasy Premier League managers. Provides player statistics, transfer recommendations, captain picks, and chip strategy advice.

## Features

- **Dashboard** — Gameweek overview, top captain picks, fixture difficulty ticker, price change predictions
- **Player Explorer** — Searchable/filterable table of all players with deep stats, form, xG/xA, ICT index, and upcoming fixture difficulty
- **Team Analyser** — Enter your FPL Team ID to see squad breakdown, weaknesses, positional analysis, GW history chart, and chip status
- **Transfer Hub** — Personalised transfer suggestions based on your squad, differentials finder, and price watch
- **Captain & Chips** — Weighted captain recommendations, chip timing strategy (Wildcard/Free Hit/Bench Boost/Triple Captain), and full fixture ticker

## Tech Stack

- Next.js 14 (App Router) with TypeScript
- Tailwind CSS dark sports theme
- Recharts for data visualisation
- FPL API proxy routes (CORS-safe)
- Algorithm engine based on x402-fpl-api concepts

## Getting Started

```bash
# Install dependencies
npm install

# Clean up scaffolding leftovers (if present)
rm -f next.config.ts.bak.old eslint.config.mjs

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

Connect your GitHub repo at [vercel.com](https://vercel.com) for automatic deployments, or:

```bash
npm i -g vercel
vercel
```

## Data Sources

1. **Official FPL API** — Player stats, fixtures, manager data, gameweek scores
2. **FPL-Core-Insights** (planned) — Deep Opta-style match stats, Elo ratings
3. **x402-fpl-api algorithms** — Captain scoring weights, transfer analysis, chip timing

## Architecture

- `src/app/api/fpl/` — Proxy routes to `fantasy.premierleague.com/api/` (avoids CORS)
- `src/lib/algorithms.ts` — Weighted scoring for captain picks, transfers, fixtures, chips, price predictions, differentials
- `src/lib/fpl-client.ts` — Server-side FPL API client with 5-minute cache
- `src/types/fpl.ts` — Full TypeScript types for the FPL API
- `src/components/` — Shared UI components (Sidebar, StatCard, FDRBadge, LoadingSpinner)
