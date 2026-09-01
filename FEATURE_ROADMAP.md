# FPL Analytics Hub — Feature Roadmap

**Research date:** 29 July 2026 · **Season state:** Pre-season (GW1 deadline 21 Aug 2026, 17:30 UTC)
**Goal:** become a one-stop shop for deep FPL statistics and predictions.

Findings below are grounded in three sources: the live FPL API response (`bootstrap-static`, inspected directly), the Premier League's official 2026/27 rule-change announcements, and a survey of what competing tools currently ship.

---

## 0. Headline finding

The live API returns **105 fields per player**. Our `FPLPlayer` type consumes roughly **50** of them.

Most of the highest-value additions below need **no new data source and no scraping** — just wider typing of a response we already fetch on every page load. Several are single-afternoon changes.

Separately, there are **three correctness issues** where the app is now out of step with 2026/27 rules. Those should jump the queue ahead of any new feature work, because they make current recommendations quietly wrong rather than merely incomplete.

---

## 1. Correctness gaps vs. 2026/27 rules — fix first

### 1.1 Defensive Contributions (DefCon) are entirely absent — **highest priority**

Introduced in 2025/26 and **confirmed to continue in 2026/27**, this is the biggest scoring change in years, and the app models none of it.

| Position | Threshold | Counts |
|---|---|---|
| DEF | 10+ CBIT | Clearances, Blocks, Interceptions, Tackles |
| MID / FWD | 12+ CBIRT | CBIT **+ Ball Recoveries** |

Worth a flat **+2** per match — a threshold bonus, not per-action, and capped at 2.

**Why it matters:** it repriced an entire player archetype. Defensive midfielders who score no goals became genuinely viable FPL assets. Our captain ranking, transfer suggestions, and squad builder all score players on attacking output plus clean sheets, so they systematically undervalue every high-volume defensive player in the game.

**The data is already sitting in the response we fetch:**

- `defensive_contribution` — season total of DefCon points
- `defensive_contribution_per_90` — the rate stat that actually predicts future returns
- `tackles`, `recoveries`, `clearances_blocks_interceptions` — raw components for a threshold-hit-rate model

**Suggested work:** add the fields to `FPLPlayer`; add a `defcon` term to the scoring model in `algorithms.ts`; surface a DefCon column in Player Explorer and a "DefCon per 90" filter. A "hit rate" derived stat (share of matches clearing the threshold) would be more predictive than the raw total and is a genuine differentiator — most competitors only show the season aggregate.

### 1.2 Chip strategy ignores the two-set split

The API's `chips` array is explicit about the windows:

```
wildcard  GW2–19   |  wildcard  GW20–38
freehit   GW2–19   |  freehit   GW20–38
bboost    GW1–19   |  bboost    GW20–38
3xc       GW1–19   |  3xc       GW20–38
```

Eight chips, two sets. **First-set chips expire at the GW19 deadline (13:30 GMT, Sat 2 Jan 2027) and cannot be carried over.**

`getChipStrategy` currently looks ahead 10 gameweeks and returns a single best gameweek per chip, with no concept of the split. Near the turn of the year it will happily recommend holding a chip that is about to be voided.

**Suggested work:** recommend one of each chip *per half*, and surface an urgency warning as the GW19 deadline approaches with chips unplayed. The Captain & Chips timeline should visually mark the GW19 boundary.

### 1.3 Bonus Points System was reworked for 2026/27

If we add any bonus-point projection, it must use the new rules:

- CBI now scores **+1 BPS per 3** actions (was per 2) — deliberately reduces centre-backs hoovering up bonus, and reduces double-dipping with DefCon
- Goalkeepers now get **+2 BPS per save**, plus **+1 extra for saves inside the box**, and **no longer** get +1 for saves outside the box

Net effect: goalkeepers, full-backs and attackers gain bonus prospects; centre-backs lose some.

### 1.4 Two smaller timing items

- **Lockdown moved to 09:00 UK the morning after** the gameweek's final match (was one hour after full time), to let post-match Opta review settle BPS and DefCon. Any "final score" state should respect this.
- **Price changes:** the PL's 2026/27 material states prices update daily at **00:00 UK**. Our Price Watch card is hardcoded to "Tonight, 01:30" — the long-standing community-observed time. These now disagree; worth reconciling, and it should be computed rather than hardcoded either way.

---

## 2. Free wins — data already in the payload

### 2.1 Player photos

`photo` is present (e.g. `"154561.jpg"`, matching `code`). Premier League serves these at:

```
https://resources.premierleague.com/premierleague/photos/players/110x140/p{code}.png
```

This replaces the "player shot" placeholder on the captain hero card immediately.

### 2.2 A live bug: XG/90 is showing a season total

The captain hero card is labelled **XG/90** but is fed `expected_goals`, which is the season aggregate. I hit this while building the card — the type didn't expose a per-90 field, so it fell back to the total.

The API does have `expected_goals_per_90`. The label is currently misleading and the fix is one field.

The full per-90 set available and unused:

`expected_goals_per_90` · `expected_assists_per_90` · `expected_goal_involvements_per_90` · `expected_goals_conceded_per_90` · `defensive_contribution_per_90` · `saves_per_90` · `clean_sheets_per_90` · `starts_per_90` · `goals_conceded_per_90`

Per-90 rates are what separate genuine analysis from a stats dump — they make rotation-risk players and mid-season signings comparable to ever-presents.

### 2.3 Pre-computed ranks → percentile badges for free

Every headline stat ships with its rank, **and** a rank within position (`_rank_type`):

`form_rank` · `ict_index_rank` · `points_per_game_rank` · `selected_rank` · `now_cost_rank` · `influence_rank` · `creativity_rank` · `threat_rank`

With `total_players` (currently **2,015,684**) these become percentile badges — "Top 3% for form among midfielders" — with zero computation on our side.

### 2.4 FPL's own expected points as a benchmark

`ep_next` and `ep_this` are FPL's internal expected-points figures. Showing ours alongside theirs is a strong credibility play: where we disagree, that *is* the insight, and it's a natural hook for a "biggest model disagreements this week" module.

### 2.5 Value metrics

`value_form` and `value_season` (points per £m) are ready-made for a budget-enabler finder — consistently one of the most-used filters in rival tools.

### 2.6 Better availability handling

We currently branch on `status` alone. Also available: `can_select`, `can_transact`, `removed`, `special`, `chance_of_playing_this_round`, `chance_of_playing_next_round`, plus `scout_risks` and `scout_news_link` (official risk flags), and `news_added` for a chronological injury feed.

### 2.7 Human-readable set-piece notes

`penalties_text`, `direct_freekicks_text`, `corners_and_indirect_freekicks_text` accompany the numeric order fields we already show.

### 2.8 Squad metadata

`birth_date` (age curves), `team_join_date` (new signings — very relevant right now in pre-season), `squad_number`, `region`, `opta_code` (join key to external datasets).

### 2.9 Monthly phases

Top-level `phases` splits the season into months (August: GW1–2, September: GW3–5, …). Enables month-by-month form tracking and "manager of the month" style views.

---

## 3. Features that would close the gap with rivals

Ordered by impact-to-effort.

### 3.1 Live Gameweek tracker — now table stakes

The headline 2026/27 change is that **everything goes live**: live world/mini-league rank, live head-to-head, and **projected bonus points added after 20 minutes** of each match, updating as it plays.

Every serious competitor has a live tracker; we have nothing that updates during matches. Endpoint: `/api/event/{id}/live/`.

Scope: live points per player, projected bonus, auto-sub detection, live rank delta.

### 3.2 Effective Ownership (EO)

The single most requested strategic metric, and we don't have it. EO = ownership + captaincy share, i.e. the number that actually determines whether a player gains or loses you rank. Without it, "differential" advice is guesswork. Derivable from league standings plus picks endpoints.

### 3.3 Mini-league analyser

`/api/leagues-classic/{id}/standings/`. Rival squad comparison, who owns what, captain splits, EO within your league, and gap-to-target modelling. This is the stickiest feature category in FPL tooling — it's inherently social and drives repeat visits.

### 3.4 Multi-gameweek fixture planner

We have an FDR grid; we lack a *planner*. Rotation pairing (find two cheap assets whose good fixtures alternate), fixture swing detection, and a transfer-path planner over the next N gameweeks.

### 3.5 Rank / season simulator

Competitors run ~100k Monte Carlo simulations for win probability and projected finish. Given we already have a scoring model, a simulator is mostly plumbing, and it's a strong differentiator versus static tables.

### 3.6 Pre-season mode — timely, ~3 weeks of runway

Right now the API confirms `most_captained: null`, `average_entry_score: 0`, no `top_element`. Every personalised dashboard stat is empty, and will be until 21 August.

This is the highest-traffic period of the FPL calendar (everyone is building their initial squad) and the dashboard currently has little to say. A pre-season view — price-locked template ownership, new signings via `team_join_date`, last-season carry-over stats, opening-fixture difficulty — would land well and is time-sensitive.

### 3.7 Player comparison

The Compare button in Player Explorer is currently rendered but disabled. Side-by-side comparison of 2–4 players across per-90s, fixtures, DefCon and ownership trend is a natural completion of work already started.

### 3.8 Watchlist

Persisted per-player watchlist with price-change alerts. Cheap to build on `localStorage`, meaningfully increases return visits.

---

## 4. Deliberately deprioritise

FPL now ships these itself for 2026/27, so building our own has poor return:

- **Price change predictor** — FPL launched an official one, tracking transfer activity for daily 00:00 changes
- **Beginner squad-building assistant** — FPL added a three-question guided squad generator

Our squad builder should lean into *depth* (optimisation, constraints, DefCon-aware scoring) rather than competing with the official beginner flow.

Also note: **FBref lost its Opta licensing in February 2026**, so it is no longer a viable enrichment source. Understat and Fantasy Football Scout are the remaining options for advanced xG data beyond the official API.

---

## 5. Suggested sequencing

**Phase 1 — correctness (do first)**
1. DefCon: types → scoring model → Player Explorer column
2. Chip strategy: respect the two-set GW19 split
3. Fix the XG/90 label bug; adopt per-90 fields throughout
4. Reconcile price-change timing

**Phase 2 — cheap depth**
5. Player photos
6. Percentile badges from rank fields
7. `ep_next` benchmark vs. our model
8. Richer availability + injury feed
9. Pre-season dashboard mode *(time-sensitive — value expires 21 Aug)*

**Phase 3 — new surfaces**
10. Live gameweek tracker
11. Effective Ownership
12. Mini-league analyser
13. Fixture planner / rotation pairing
14. Player comparison + watchlist

**Phase 4 — differentiation**
15. Monte Carlo rank simulator
16. Model-disagreement insights

---

## Sources

- [All you need to know about changes to FPL for 2026/27 — premierleague.com](https://www.premierleague.com/en/news/4679873/all-you-need-to-know-about-changes-to-fpl-for-202627)
- [What's happening with defensive contribution points — premierleague.com](https://www.premierleague.com/en/news/4361991)
- [FPL player price changes: how, why and when — premierleague.com](https://www.premierleague.com/en/news/2858775)
- [FPL 2026/27: 5 rule changes + new features announced — Fantasy Football Scout](https://www.fantasyfootballscout.co.uk/2026/07/20/fpl-2026-27-5-rule-changes-new-features-announced)
- [FPL 2026/27 Changes: Live Ranks, Bonus Points & Chips — Fantasy Football Fix](https://www.fantasyfootballfix.com/blog-index/fpl-2026-27-new-rules/)
- [FPL Defensive Contributions 2026/27: How DEFCON Points Work — Draft Fantasy](https://www.draftfantasy.com/blog/fpl-defensive-contributions-2026-27)
- [FPL Price Change Predictions — FPL Form](https://fplform.com/fpl-price-change)
- [Best FPL Tools for 2026/27 — FPL Pulse](https://www.fplpulse.com/blog/best-fpl-tools)
- [FPL Mini-League Predictions: Season Simulation & Projections](https://www.fplpulse.com/blog/fpl-mini-league-predictions-simulator)
- [FPL Dashboard — fpl.page](https://fpl.page/)
- [FPL Review — Projections, Planner & Solver](https://fplreview.com/)
- Live FPL API `bootstrap-static` response, inspected 29 July 2026
