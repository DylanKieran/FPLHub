import type { FPLPlayer, FPLTeam, FPLFixture, FPLEvent, FPLPick, FPLChip } from '@/types/fpl';

export interface PlayerHistoryMap {
  [playerId: number]: Array<{
    season_name: string;
    total_points: number;
    minutes: number;
    goals_scored: number;
    assists: number;
    clean_sheets: number;
    bonus: number;
    bps: number;
    starts: number;
    expected_goals: string;
    expected_assists: string;
    ict_index: string;
    influence: string;
    creativity: string;
    threat: string;
  }>;
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const FDR_MULTIPLIER: Record<number, number> = {
  1: 1.30, 2: 1.15, 3: 1.00, 4: 0.85, 5: 0.70,
};

const CAPTAIN_WEIGHTS = {
  ppg: 5.92,
  form: 3.43,
  bonus_per_game: 1.31,
  penalty_taker: 1.90,
  xg_per_90: 1.07,
  xa_per_90: 0.92,
  minutes_certainty: 1.04,
  set_piece: 0.84,
  dreamteam_rate: 0.56,
  ict: 0.01,
  ep_next: 0.49,
  defensive_contrib: 0.59,
};

const GOALS_POINTS: Record<number, number> = { 1: 10, 2: 6, 3: 5, 4: 4 };
const CS_POINTS: Record<number, number> = { 1: 4, 2: 4, 3: 1, 4: 0 };

// FDR-based attack/defence modifiers for xPts
// FDR 1 = weak opponent → you score more / concede less
const FDR_ATTACK_MOD: Record<number, number> = { 1: 1.35, 2: 1.15, 3: 1.00, 4: 0.82, 5: 0.65 };
const FDR_DEFENCE_MOD: Record<number, number> = { 1: 1.40, 2: 1.18, 3: 1.00, 4: 0.78, 5: 0.60 };

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

function getPlayerFixtures(
  player: FPLPlayer,
  fixtures: FPLFixture[],
  events: FPLEvent[],
  gameweeksAhead: number = 5
): Array<{ fixture: FPLFixture; isHome: boolean; difficulty: number; event: number }> {
  const nextEvent = events.find(e => e.is_next);
  if (!nextEvent) return [];
  const targetGWs = Array.from({ length: gameweeksAhead }, (_, i) => nextEvent.id + i);

  return fixtures
    .filter(f => f.event !== null && targetGWs.includes(f.event!) &&
      (f.team_h === player.team || f.team_a === player.team))
    .map(f => ({
      fixture: f,
      isHome: f.team_h === player.team,
      difficulty: f.team_h === player.team ? f.team_h_difficulty : f.team_a_difficulty,
      event: f.event!,
    }));
}

function getFixtureDifficultyScore(difficulty: number, isHome: boolean): number {
  const base = FDR_MULTIPLIER[difficulty] ?? 1.0;
  return base * (isHome ? 1.15 : 0.95);
}

// ═══════════════════════════════════════════════════════════════
// DEFENSIVE CONTRIBUTIONS (DefCon)
// Introduced 2025/26, retained for 2026/27.
//   DEF      → +2 when a player records 10+ CBIT
//              (clearances, blocks, interceptions, tackles)
//   MID/FWD  → +2 when a player records 12+ CBIRT (CBIT + recoveries)
// It is a threshold bonus, capped at +2 per match — not per-action.
// ═══════════════════════════════════════════════════════════════

/** CBIT/CBIRT threshold a player must clear in a match to bank +2. */
export function defconThreshold(elementType: number): number {
  return elementType === 2 ? 10 : 12;
}

/** Whether DefCon is a meaningful scoring route for this position. */
export function isDefconEligible(elementType: number): boolean {
  // Goalkeepers cannot realistically accrue CBIT volume.
  return elementType === 2 || elementType === 3 || elementType === 4;
}

/**
 * Whether the API is actually reporting defensive data for this player.
 *
 * FPL zeroes the whole DefCon family (defensive_contribution, tackles,
 * recoveries, CBI) during pre-season while other stats still carry last
 * season's totals — so a player with substantial minutes but no recorded
 * defensive actions means "not published yet", not "genuinely zero".
 * Distinguishing the two keeps us from rendering a confident 0.00.
 */
export function hasDefconData(player: FPLPlayer): boolean {
  if ((player.minutes || 0) <= 0) return false;
  return (
    (player.defensive_contribution || 0) > 0 ||
    (player.tackles || 0) > 0 ||
    (player.recoveries || 0) > 0 ||
    (player.clearances_blocks_interceptions || 0) > 0
  );
}

/** True when no player in the dataset has DefCon data yet (i.e. pre-season). */
export function isDefconDataAvailable(players: FPLPlayer[]): boolean {
  return players.some(hasDefconData);
}

// ═══════════════════════════════════════════════════════════════
// PERCENTILE RANKS
// The API pre-computes ranks for the headline stats, both overall
// (`*_rank`) and within position (`*_rank_type`), so percentiles
// need no computation of our own — only a denominator.
// ═══════════════════════════════════════════════════════════════

/** Count of players sharing a position, used as the rank_type denominator. */
export function positionCounts(players: FPLPlayer[]): Record<number, number> {
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const p of players) {
    if (counts[p.element_type] !== undefined) counts[p.element_type]++;
  }
  return counts;
}

/**
 * Convert a 1-based rank into a top-N percentile.
 * Rank 1 of 500 → 0.2 (i.e. "top 0.2%"). Returns null when unranked.
 */
export function rankToTopPercent(rank: number | null | undefined, total: number): number | null {
  if (!rank || rank < 1 || total < 1) return null;
  return Math.max(0.1, (rank / total) * 100);
}

/**
 * Human label for a percentile.
 *
 * "Top N%" only reads naturally for above-median players — describing someone
 * ranked 185th of 220 as "Top 84%" is technically true but misleading. Below
 * the median we show the raw rank instead, which is unambiguous.
 */
export function formatTopPercent(topPercent: number | null, rank?: number | null, total?: number): string {
  if (topPercent === null) return '—';
  if (topPercent <= 50) {
    return topPercent < 1 ? 'Top 1%' : `Top ${Math.round(topPercent)}%`;
  }
  if (rank && total) return `#${rank}/${total}`;
  return `Top ${Math.round(topPercent)}%`;
}

/**
 * Whether a stat varies across the dataset.
 *
 * Pre-season, stats like `form` are zero for every player, so their ranks are
 * arbitrary tie-breaks rather than meaningful signal. Checking for spread lets
 * callers hide percentiles that would otherwise look authoritative but aren't.
 */
export function statHasSpread(players: FPLPlayer[], accessor: (p: FPLPlayer) => number): boolean {
  let first: number | null = null;
  for (const p of players) {
    const v = accessor(p);
    if (first === null) { first = v; continue; }
    if (v !== first) return true;
  }
  return false;
}

/** Elite (<=5%), strong (<=20%), average, or weak — for badge colouring. */
export function percentileTier(topPercent: number | null): 'elite' | 'strong' | 'average' | 'weak' | 'none' {
  if (topPercent === null) return 'none';
  if (topPercent <= 5) return 'elite';
  if (topPercent <= 20) return 'strong';
  if (topPercent <= 60) return 'average';
  return 'weak';
}

// ═══════════════════════════════════════════════════════════════
// AVAILABILITY
// `status` alone is coarse. The API also exposes playing chance,
// whether a player can still be selected or transacted, and whether
// they've been removed from the game entirely (e.g. left the league).
// ═══════════════════════════════════════════════════════════════

export type AvailabilityLevel = 'available' | 'doubtful' | 'unlikely' | 'out' | 'suspended' | 'unavailable';

export interface AvailabilityInfo {
  level: AvailabilityLevel;
  label: string;
  /** Playing chance for the next round, when published (0–100). */
  chance: number | null;
  /** Short reason drawn from the player's news entry. */
  note: string;
  /** Whether the player can still be brought into a squad. */
  selectable: boolean;
  /** True for players withdrawn from the game entirely. */
  withdrawn: boolean;
}

export function getAvailability(player: FPLPlayer): AvailabilityInfo {
  const chance = player.chance_of_playing_next_round;
  const note = (player.news || '').trim();
  // `removed` / `can_select` are false for players who have left the league.
  const withdrawn = player.removed === true || player.can_select === false;
  const selectable = !withdrawn && player.can_select !== false;

  if (withdrawn) {
    return { level: 'unavailable', label: 'Left the league', chance: 0, note, selectable: false, withdrawn: true };
  }

  if (player.status === 's') {
    return { level: 'suspended', label: 'Suspended', chance: chance ?? 0, note, selectable, withdrawn: false };
  }

  // Playing chance is the most precise signal when FPL publishes it.
  if (typeof chance === 'number') {
    if (chance === 0) return { level: 'out', label: 'Out', chance, note, selectable, withdrawn: false };
    if (chance <= 25) return { level: 'unlikely', label: `${chance}% chance`, chance, note, selectable, withdrawn: false };
    if (chance < 100) return { level: 'doubtful', label: `${chance}% chance`, chance, note, selectable, withdrawn: false };
  }

  if (player.status === 'i') return { level: 'out', label: 'Injured', chance: chance ?? 0, note, selectable, withdrawn: false };
  if (player.status === 'd') return { level: 'doubtful', label: 'Doubtful', chance, note, selectable, withdrawn: false };
  if (player.status === 'u') return { level: 'unavailable', label: 'Unavailable', chance: chance ?? 0, note, selectable, withdrawn: false };

  return { level: 'available', label: 'Available', chance: chance ?? 100, note, selectable, withdrawn: false };
}

/** Colour token for an availability level. */
export function availabilityColor(level: AvailabilityLevel): string {
  switch (level) {
    case 'available': return 'var(--semantic-green-500)';
    case 'doubtful': return 'var(--semantic-amber-500)';
    case 'unlikely': return 'var(--semantic-amber-600)';
    case 'suspended': return 'var(--semantic-red-500)';
    case 'out': return 'var(--semantic-red-500)';
    default: return 'var(--text-tertiary)';
  }
}

export interface InjuryFeedEntry {
  player: FPLPlayer;
  team: FPLTeam;
  availability: AvailabilityInfo;
  /** When FPL published the news, used for ordering. */
  newsAdded: Date | null;
}

/**
 * Recently published availability news, newest first.
 * Only players with an actual news entry are included.
 */
export function getInjuryFeed(
  players: FPLPlayer[],
  teams: FPLTeam[],
  limit = 12
): InjuryFeedEntry[] {
  const teamMap = new Map(teams.map(t => [t.id, t]));

  return players
    .filter(p => (p.news || '').trim().length > 0)
    .map(p => {
      const team = teamMap.get(p.team);
      if (!team) return null;
      return {
        player: p,
        team,
        availability: getAvailability(p),
        newsAdded: p.news_added ? new Date(p.news_added) : null,
      };
    })
    .filter((e): e is InjuryFeedEntry => e !== null)
    .sort((a, b) => {
      const at = a.newsAdded?.getTime() ?? 0;
      const bt = b.newsAdded?.getTime() ?? 0;
      if (bt !== at) return bt - at;
      // Tie-break on ownership so the most relevant news floats up.
      return parseFloat(b.player.selected_by_percent) - parseFloat(a.player.selected_by_percent);
    })
    .slice(0, limit);
}

/**
 * Estimated share of appearances in which a player clears their DefCon
 * threshold. `defensive_contribution` is the season total of DefCon POINTS
 * (awarded in blocks of 2), so dividing by 2 recovers the number of matches
 * the threshold was cleared.
 */
export function defconHitRate(player: FPLPlayer): number {
  const appearances = player.starts || 0;
  if (appearances <= 0) return 0;
  const matchesHit = (player.defensive_contribution || 0) / 2;
  return Math.max(0, Math.min(1, matchesHit / appearances));
}

/** Expected DefCon points per 90 minutes. */
export function defconPointsPer90(player: FPLPlayer): number {
  if (!isDefconEligible(player.element_type)) return 0;
  const per90 = player.defensive_contribution_per_90;
  if (typeof per90 === 'number' && per90 > 0) return per90;
  // Fall back to deriving it from the season total when the rate is absent.
  const minutes = player.minutes || 0;
  if (minutes <= 0) return 0;
  return ((player.defensive_contribution || 0) / minutes) * 90;
}

/** Raw defensive actions per 90 (CBIT for DEF, CBIRT for MID/FWD). */
export function defensiveActionsPer90(player: FPLPlayer): number {
  const minutes = player.minutes || 0;
  if (minutes <= 0) return 0;
  const cbi = player.clearances_blocks_interceptions || 0;
  const tackles = player.tackles || 0;
  const recoveries = player.element_type === 2 ? 0 : (player.recoveries || 0);
  return ((cbi + tackles + recoveries) / minutes) * 90;
}

function getInjuryPenalty(player: FPLPlayer): number {
  if (player.status === 'i') return -3.0;
  if (player.status === 'd') return -1.5;
  if (player.status === 's') return -3.0;
  if (player.status === 'u') return -3.0;
  if (player.news && player.news.length > 0) {
    const lower = player.news.toLowerCase();
    if (lower.includes('unknown return')) return -3.0;
    if (lower.includes('hamstring') || lower.includes('knee') || lower.includes('suspended')) return -2.0;
  }
  return 0;
}

// Pre-season helper: get effective stats from history when current season is empty
function getEffectiveStats(player: FPLPlayer, historyMap?: PlayerHistoryMap) {
  const hasCurrentData = player.minutes > 0;

  if (hasCurrentData) {
    return {
      ppg: parseFloat(player.points_per_game) || 0,
      form: parseFloat(player.form) || 0,
      ict: parseFloat(player.ict_index) || 0,
      xg: parseFloat(player.expected_goals) || 0,
      xa: parseFloat(player.expected_assists) || 0,
      minutes: player.minutes,
      starts: player.starts || 1,
      bonus: player.bonus,
      totalPoints: player.total_points,
      goals: player.goals_scored,
      assists: player.assists,
      cleanSheets: player.clean_sheets,
      isHistorical: false,
    };
  }

  // Fall back to last season's data
  const history = historyMap?.[player.id];
  if (history && history.length > 0) {
    // Use the most recent season
    const last = history[history.length - 1];
    const starts = last.starts || 1;
    const minutes = last.minutes || 1;
    return {
      ppg: starts > 0 ? last.total_points / starts : 0,
      form: starts > 0 ? last.total_points / starts : 0, // Use PPG as proxy for form
      ict: parseFloat(last.ict_index) || 0,
      xg: parseFloat(last.expected_goals) || 0,
      xa: parseFloat(last.expected_assists) || 0,
      minutes: last.minutes,
      starts: last.starts,
      bonus: last.bonus,
      totalPoints: last.total_points,
      goals: last.goals_scored,
      assists: last.assists,
      cleanSheets: last.clean_sheets,
      isHistorical: true,
    };
  }

  // No data at all — return zeros
  return {
    ppg: 0, form: 0, ict: 0, xg: 0, xa: 0,
    minutes: 0, starts: 0, bonus: 0, totalPoints: 0,
    goals: 0, assists: 0, cleanSheets: 0,
    isHistorical: false,
  };
}

// ═══════════════════════════════════════════════════════════════
// CAPTAIN PICKS
// ═══════════════════════════════════════════════════════════════

export interface CaptainPick {
  player: FPLPlayer;
  team: FPLTeam;
  score: number;
  fixtures: Array<{ opponent: string; isHome: boolean; difficulty: number }>;
  reasoning: string;
}

export function getCaptainPicks(
  players: FPLPlayer[],
  teams: FPLTeam[],
  fixtures: FPLFixture[],
  events: FPLEvent[],
  topN: number = 10,
  historyMap?: PlayerHistoryMap
): CaptainPick[] {
  const available = players.filter(p => p.status === 'a' || p.status === 'd');
  if (available.length === 0) return [];

  // Compute normalization ranges
  const ppgValues = available.map(p => parseFloat(p.points_per_game) || 0);
  const formValues = available.map(p => parseFloat(p.form) || 0);
  const ictValues = available.map(p => parseFloat(p.ict_index) || 0);

  const ppgMin = Math.min(...ppgValues), ppgMax = Math.max(...ppgValues);
  const formMin = Math.min(...formValues), formMax = Math.max(...formValues);
  const ictMin = Math.min(...ictValues), ictMax = Math.max(...ictValues);

  const teamMap = new Map(teams.map(t => [t.id, t]));

  const scored = available.map(player => {
    const stats = getEffectiveStats(player, historyMap);
    const { ppg, form, ict, xg, xa, minutes, starts, bonus } = stats;

    const bonusPerGame = starts > 0 ? bonus / starts : 0;
    const xgPer90 = minutes > 0 ? (xg / minutes) * 90 : 0;
    const xaPer90 = minutes > 0 ? (xa / minutes) * 90 : 0;
    const minutesCertainty = starts > 0 ? Math.min(1, minutes / (starts * 90)) : 0;
    const isPenaltyTaker = player.penalties_order === 1 ? 1 : 0;
    const setpiece = (player.corners_and_indirect_freekicks_order === 1 || player.direct_freekicks_order === 1) ? 1 : 0;
    const dreamteamRate = starts > 0 ? player.dreamteam_count / starts : 0;
    const epNext = parseFloat(player.ep_next || '0');
    // Real DefCon: expected defensive-contribution points per 90.
    // ~2.0 per 90 is an elite ceiling (threshold cleared virtually every match).
    const defconP90 = defconPointsPer90(player);

    let baseScore =
      CAPTAIN_WEIGHTS.ppg * normalize(ppg, ppgMin, ppgMax) +
      CAPTAIN_WEIGHTS.form * normalize(form, formMin, formMax) +
      CAPTAIN_WEIGHTS.bonus_per_game * normalize(bonusPerGame, 0, 3) +
      CAPTAIN_WEIGHTS.penalty_taker * isPenaltyTaker +
      CAPTAIN_WEIGHTS.xg_per_90 * normalize(xgPer90, 0, 1) +
      CAPTAIN_WEIGHTS.xa_per_90 * normalize(xaPer90, 0, 0.5) +
      CAPTAIN_WEIGHTS.minutes_certainty * minutesCertainty +
      CAPTAIN_WEIGHTS.set_piece * setpiece +
      CAPTAIN_WEIGHTS.dreamteam_rate * normalize(dreamteamRate, 0, 0.3) +
      CAPTAIN_WEIGHTS.ict * normalize(ict, ictMin, ictMax) +
      CAPTAIN_WEIGHTS.ep_next * normalize(epNext, 0, 10) +
      CAPTAIN_WEIGHTS.defensive_contrib * normalize(defconP90, 0, 2);

    baseScore += getInjuryPenalty(player);

    // Compress base score
    baseScore = baseScore > 0 ? Math.pow(baseScore, 0.9) : baseScore;

    // Fixture multiplier (score on next GW only)
    const playerFixturesScoring = getPlayerFixtures(player, fixtures, events, 1);
    let fixtureMultiplier = 1.0;

    if (playerFixturesScoring.length > 0) {
      const avgFDR = playerFixturesScoring.reduce((sum, f) => sum + getFixtureDifficultyScore(f.difficulty, f.isHome), 0) / playerFixturesScoring.length;
      fixtureMultiplier = avgFDR * (playerFixturesScoring.length > 1 ? 1.5 : 1.0); // DGW bonus
    }

    // Display fixtures: next 3 GWs for context
    const playerFixturesDisplay = getPlayerFixtures(player, fixtures, events, 3);
    const fixtureDetails: CaptainPick['fixtures'] = [];
    for (const pf of playerFixturesDisplay) {
      const opponent = pf.isHome
        ? teamMap.get(pf.fixture.team_a)
        : teamMap.get(pf.fixture.team_h);
      fixtureDetails.push({
        opponent: opponent?.short_name ?? '???',
        isHome: pf.isHome,
        difficulty: pf.difficulty,
      });
    }

    const finalScore = baseScore * fixtureMultiplier;

    // Generate reasoning
    const reasons: string[] = [];
    if (ppg > ppgMax * 0.7) reasons.push(`High PPG (${ppg})`);
    if (form > formMax * 0.7) reasons.push(`Strong form (${form})`);
    if (isPenaltyTaker) reasons.push('Penalty taker');
    if (defconP90 >= 1.2) reasons.push(`Reliable DefCon (${defconP90.toFixed(1)}/90)`);
    if (playerFixturesScoring.length > 1) reasons.push('Double Gameweek');
    if (fixtureDetails.some(f => f.difficulty <= 2)) reasons.push('Easy fixture');
    if (fixtureDetails.some(f => f.isHome)) reasons.push('Home advantage');
    if (stats.isHistorical) reasons.push('Based on last season');

    return {
      player,
      team: teamMap.get(player.team)!,
      score: finalScore,
      fixtures: fixtureDetails,
      reasoning: reasons.join(' | ') || 'Solid overall pick',
    };
  });

  // Sort and enforce max 2 per team
  scored.sort((a, b) => b.score - a.score);
  const result: CaptainPick[] = [];
  const teamCounts = new Map<number, number>();

  for (const pick of scored) {
    const count = teamCounts.get(pick.player.team) || 0;
    if (count >= 2) continue;
    teamCounts.set(pick.player.team, count + 1);
    result.push(pick);
    if (result.length >= topN) break;
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════
// TRANSFER SUGGESTIONS
// ═══════════════════════════════════════════════════════════════

export interface TransferSuggestion {
  playerOut: FPLPlayer;
  playerOutTeam: FPLTeam;
  sellReason: string;
  sellScore: number;
  replacements: Array<{
    player: FPLPlayer;
    team: FPLTeam;
    valueScore: number;
    captainScore: number;
    reasons: string[];
  }>;
}

function getValueScore(
  player: FPLPlayer,
  fixtures: FPLFixture[],
  events: FPLEvent[],
  teams: FPLTeam[],
  historyMap?: PlayerHistoryMap
): number {
  const stats = getEffectiveStats(player, historyMap);
  const { form, ppg } = stats;

  const playerFixtures = getPlayerFixtures(player, fixtures, events, 3);
  let fixtureScore = 0;
  const weights = [1.0, 0.5, 0.3];

  for (let i = 0; i < playerFixtures.length && i < 3; i++) {
    const fdr = getFixtureDifficultyScore(playerFixtures[i].difficulty, playerFixtures[i].isHome);
    fixtureScore += fdr * weights[i];
  }

  let score = form * 2.0 + ppg * 1.0 + fixtureScore;

  // Defensive bonus for defenders
  if (player.element_type === 2) score += (stats.cleanSheets / Math.max(1, stats.starts)) * 2;

  // Injury penalty
  score += getInjuryPenalty(player);

  return score;
}

export function getTransferSuggestions(
  squadPicks: FPLPick[],
  players: FPLPlayer[],
  teams: FPLTeam[],
  fixtures: FPLFixture[],
  events: FPLEvent[],
  freeTransfers: number = 1,
  bank: number = 0,
  historyMap?: PlayerHistoryMap
): TransferSuggestion[] {
  const playerMap = new Map(players.map(p => [p.id, p]));
  const teamMap = new Map(teams.map(t => [t.id, t]));

  // Score squad players
  const squadScored = squadPicks
    .map(pick => {
      const player = playerMap.get(pick.element);
      if (!player) return null;
      return {
        pick,
        player,
        valueScore: getValueScore(player, fixtures, events, teams, historyMap),
      };
    })
    .filter(Boolean) as Array<{ pick: FPLPick; player: FPLPlayer; valueScore: number }>;

  // Sort by value score ascending — worst players first
  squadScored.sort((a, b) => a.valueScore - b.valueScore);

  const suggestions: TransferSuggestion[] = [];
  const squadTeamIds = new Set(squadScored.map(s => s.player.team));

  for (let i = 0; i < freeTransfers && i < squadScored.length; i++) {
    const { player: playerOut, valueScore: sellScore } = squadScored[i];
    const teamOut = teamMap.get(playerOut.team)!;

    // Generate sell reason
    const reasons: string[] = [];
    if (parseFloat(playerOut.form) < 3) reasons.push(`Low form (${playerOut.form})`);
    if (playerOut.status !== 'a') reasons.push(`${playerOut.status === 'i' ? 'Injured' : playerOut.status === 'd' ? 'Doubtful' : 'Unavailable'}`);
    const upcomingFixtures = getPlayerFixtures(playerOut, fixtures, events, 3);
    if (upcomingFixtures.length > 0 && upcomingFixtures.every(f => f.difficulty >= 4)) reasons.push('Tough fixtures ahead');

    // Find replacements: same position, affordable, uninjured, not already in squad, higher value score
    const budget = (playerOut.now_cost + bank);
    const samePosition = players.filter(p =>
      p.element_type === playerOut.element_type &&
      p.id !== playerOut.id &&
      p.now_cost <= budget &&
      (p.status === 'a') &&
      (p.minutes > 0 || (historyMap && historyMap[p.id]?.length > 0)) &&
      !squadPicks.some(sp => sp.element === p.id)
    );

    // Check team limits (max 3 per team)
    const teamCountMap = new Map<number, number>();
    for (const s of squadScored) {
      if (s.player.id === playerOut.id) continue;
      const count = teamCountMap.get(s.player.team) || 0;
      teamCountMap.set(s.player.team, count + 1);
    }

    const validReplacements = samePosition.filter(p => {
      const currentTeamCount = teamCountMap.get(p.team) || 0;
      return currentTeamCount < 3;
    });

    const replacementsScored = validReplacements.map(p => {
      const vs = getValueScore(p, fixtures, events, teams, historyMap);
      const captainPicks = getCaptainPicks([p], teams, fixtures, events, 1, historyMap);
      return {
        player: p,
        team: teamMap.get(p.team)!,
        valueScore: vs,
        captainScore: captainPicks[0]?.score ?? 0,
        reasons: generateReplacementReasons(p, fixtures, events),
      };
    });

    replacementsScored.sort((a, b) => b.valueScore - a.valueScore);

    suggestions.push({
      playerOut,
      playerOutTeam: teamOut,
      sellReason: reasons.join(', ') || 'Low value score',
      sellScore,
      replacements: replacementsScored.slice(0, 5),
    });
  }

  return suggestions;
}

function generateReplacementReasons(player: FPLPlayer, fixtures: FPLFixture[], events: FPLEvent[]): string[] {
  const reasons: string[] = [];
  const form = parseFloat(player.form) || 0;
  if (form > 6) reasons.push(`Excellent form (${form})`);
  else if (form > 4) reasons.push(`Good form (${form})`);
  if (player.penalties_order === 1) reasons.push('On penalties');
  const upcoming = getPlayerFixtures(player, fixtures, events, 3);
  if (upcoming.some(f => f.difficulty <= 2)) reasons.push('Easy upcoming fixtures');
  if (upcoming.length > 1 && upcoming.filter(f => f.event === upcoming[0].event).length > 1) reasons.push('Double Gameweek');
  const ownership = parseFloat(player.selected_by_percent);
  if (ownership < 10) reasons.push(`Differential (${ownership}% owned)`);
  return reasons;
}

// ═══════════════════════════════════════════════════════════════
// FIXTURE DIFFICULTY ANALYSIS
// ═══════════════════════════════════════════════════════════════

export interface TeamFixtureRun {
  team: FPLTeam;
  avgDifficulty: number;
  adjustedDifficulty: number;
  fixtures: Array<{
    event: number;
    opponent: string;
    isHome: boolean;
    difficulty: number;
  }>;
}

export function getFixtureOutlook(
  teams: FPLTeam[],
  fixtures: FPLFixture[],
  events: FPLEvent[],
  gameweeksAhead: number = 5
): TeamFixtureRun[] {
  const nextEvent = events.find(e => e.is_next);
  if (!nextEvent) return [];

  const targetGWs = Array.from({ length: gameweeksAhead }, (_, i) => nextEvent.id + i);
  const teamMap = new Map(teams.map(t => [t.id, t]));

  return teams.map(team => {
    const teamFixtures = fixtures
      .filter(f => f.event !== null && targetGWs.includes(f.event!) &&
        (f.team_h === team.id || f.team_a === team.id))
      .map(f => {
        const isHome = f.team_h === team.id;
        const opponentId = isHome ? f.team_a : f.team_h;
        const difficulty = isHome ? f.team_h_difficulty : f.team_a_difficulty;
        return {
          event: f.event!,
          opponent: teamMap.get(opponentId)?.short_name ?? '???',
          isHome,
          difficulty,
        };
      });

    const difficulties = teamFixtures.map(f => getFixtureDifficultyScore(f.difficulty, f.isHome));
    const avgDifficulty = difficulties.length > 0
      ? difficulties.reduce((a, b) => a + b, 0) / difficulties.length
      : 1.0;

    // Variance penalty
    const variance = difficulties.length > 1
      ? difficulties.reduce((sum, d) => sum + Math.pow(d - avgDifficulty, 2), 0) / difficulties.length
      : 0;

    return {
      team,
      avgDifficulty,
      adjustedDifficulty: avgDifficulty - variance * 0.1,
      fixtures: teamFixtures,
    };
  }).sort((a, b) => b.adjustedDifficulty - a.adjustedDifficulty); // Higher = easier fixtures
}

// ═══════════════════════════════════════════════════════════════
// CHIP STRATEGY
// ═══════════════════════════════════════════════════════════════

export interface ChipRecommendation {
  chip: string;
  chipLabel: string;
  bestGameweek: number | null;
  score: number;
  reasoning: string;
  subLabel: 'DOUBLE' | 'BLANK' | null;
  gameweekScores: Array<{ event: number; score: number; reason: string }>;
  /** Which half of the season this chip instance belongs to (1 or 2). */
  half: 1 | 2;
  /** Inclusive gameweek window in which this chip may be played. */
  window: { start: number; stop: number };
  /** True when the window closes soon and the chip is still unplayed. */
  expiringSoon: boolean;
  /** Gameweeks remaining in this chip's window (0 if already closed). */
  gameweeksRemaining: number;
}

/**
 * 2026/27 ships TWO sets of chips. Set 1 must be played before the GW19
 * deadline and CANNOT be carried over; set 2 covers GW20–38.
 * These are the documented defaults, used when the API's `chips` array
 * isn't supplied by the caller.
 */
const DEFAULT_CHIP_WINDOWS: Array<{ name: string; half: 1 | 2; start: number; stop: number }> = [
  { name: 'wildcard', half: 1, start: 2, stop: 19 },
  { name: 'freehit', half: 1, start: 2, stop: 19 },
  { name: 'bboost', half: 1, start: 1, stop: 19 },
  { name: '3xc', half: 1, start: 1, stop: 19 },
  { name: 'wildcard', half: 2, start: 20, stop: 38 },
  { name: 'freehit', half: 2, start: 20, stop: 38 },
  { name: 'bboost', half: 2, start: 20, stop: 38 },
  { name: '3xc', half: 2, start: 20, stop: 38 },
];

/** Warn when a chip's window has this many gameweeks or fewer left. */
const EXPIRY_WARNING_GWS = 4;

export function getChipStrategy(
  events: FPLEvent[],
  fixtures: FPLFixture[],
  teams: FPLTeam[],
  chipsUsed: string[],
  apiChips?: FPLChip[]
): ChipRecommendation[] {
  const nextEvent = events.find(e => e.is_next);
  if (!nextEvent) return [];

  const currentGW = nextEvent.id;

  // Derive the real chip windows from the API when available, so the two-set
  // split stays correct if FPL ever changes the boundary.
  const windows = apiChips && apiChips.length > 0
    ? apiChips.map(c => ({
        name: c.name as string,
        half: (c.start_event >= 20 ? 2 : 1) as 1 | 2,
        start: c.start_event,
        stop: c.stop_event,
      }))
    : DEFAULT_CHIP_WINDOWS;

  // Only consider windows that haven't already closed.
  const openWindows = windows.filter(w => w.stop >= currentGW);

  // Score every gameweek that any open window can reach.
  const maxStop = openWindows.reduce((m, w) => Math.max(m, w.stop), currentGW);
  const targetGWs = Array.from(
    { length: Math.max(0, maxStop - currentGW + 1) },
    (_, i) => currentGW + i
  ).filter(gw => gw <= 38);

  const chipLabels: Record<string, string> = {
    wildcard: 'Wildcard',
    freehit: 'Free Hit',
    bboost: 'Bench Boost',
    '3xc': 'Triple Captain',
  };

  // Detect DGW and BGW gameweeks
  const gwTeamCount = new Map<number, { playing: Set<number>; total: number }>();
  for (const gw of targetGWs) {
    const gwFixtures = fixtures.filter(f => f.event === gw);
    const teamsPlaying = new Set<number>();
    for (const f of gwFixtures) {
      teamsPlaying.add(f.team_h);
      teamsPlaying.add(f.team_a);
    }
    // Count DGW teams (teams with >1 fixture)
    const teamFixtureCounts = new Map<number, number>();
    for (const f of gwFixtures) {
      teamFixtureCounts.set(f.team_h, (teamFixtureCounts.get(f.team_h) || 0) + 1);
      teamFixtureCounts.set(f.team_a, (teamFixtureCounts.get(f.team_a) || 0) + 1);
    }
    const dgwTeams = [...teamFixtureCounts.entries()].filter(([, c]) => c > 1).length;
    gwTeamCount.set(gw, { playing: teamsPlaying, total: dgwTeams });
  }

  return openWindows.map(win => {
    const chip = win.name;

    // Only gameweeks inside THIS chip instance's window are eligible.
    const eligibleGWs = targetGWs.filter(gw => gw >= win.start && gw <= win.stop);

    const gameweekScores = eligibleGWs.map(gw => {
      const info = gwTeamCount.get(gw)!;
      const blanking = 20 - info.playing.size;
      const dgwTeams = info.total;
      let score = 0;
      let reason = '';

      switch (chip) {
        case 'bboost':
          score = dgwTeams * 8 + info.playing.size * 0.5;
          reason = dgwTeams > 0 ? `${dgwTeams} DGW teams` : 'Standard gameweek';
          break;
        case 'freehit':
          score = blanking * 10;
          if (blanking >= 5) reason = `${blanking} teams blanking — strong Free Hit candidate`;
          else reason = blanking > 0 ? `${blanking} teams blanking` : 'No blanks';
          break;
        case '3xc':
          score = dgwTeams * 6 + (info.playing.size >= 20 ? 5 : 0);
          reason = dgwTeams > 0 ? `DGW — captain plays twice` : 'Single GW';
          break;
        case 'wildcard':
          score = 5; // Base score — wildcards are more strategic/reactive
          if (dgwTeams > 3) { score += 10; reason = 'Setup for big DGW'; }
          else reason = 'Strategic squad overhaul window';
          break;
      }

      return { event: gw, score, reason };
    });

    gameweekScores.sort((a, b) => b.score - a.score);
    const best = gameweekScores[0];
    const bestGameweek = best?.score > 0 ? best.event : null;
    const bestInfo = bestGameweek ? gwTeamCount.get(bestGameweek) : null;
    const bestDgwTeams = bestInfo?.total ?? 0;
    const bestBlanking = bestInfo ? 20 - bestInfo.playing.size : 0;
    const bestPlaying = bestInfo?.playing.size ?? 20;

    const alreadyUsed = chipsUsed.includes(chip);
    const gameweeksRemaining = Math.max(0, win.stop - currentGW + 1);
    const expiringSoon = !alreadyUsed && gameweeksRemaining <= EXPIRY_WARNING_GWS;

    let subLabel: 'DOUBLE' | 'BLANK' | null = null;
    let reasoning = 'No strong candidate in this window';

    if (bestGameweek) {
      switch (chip) {
        case 'bboost':
          if (bestDgwTeams > 0) {
            subLabel = 'DOUBLE';
            reasoning = `Double gameweek — ${bestDgwTeams} of 20 teams have two fixtures, boosting bench points.`;
          } else {
            reasoning = 'Standard single gameweek — modest bench-boost value this window.';
          }
          break;
        case 'freehit':
          if (bestBlanking > 0) {
            subLabel = 'BLANK';
            reasoning = `Blank gameweek — only ${bestPlaying} of 20 teams have a fixture. Navigate it rather than burning transfers.`;
          } else {
            reasoning = 'No blank fixtures detected in this window — hold Free Hit for a tougher gameweek.';
          }
          break;
        case '3xc':
          if (bestDgwTeams > 0) {
            subLabel = 'DOUBLE';
            reasoning = `Double gameweek — your captain's team plays twice, maximising the triple multiplier.`;
          } else {
            reasoning = 'Single gameweek — no doubling advantage, better held for a DGW.';
          }
          break;
        case 'wildcard':
          if (bestDgwTeams > 3) {
            reasoning = `Rebuild ahead of the upcoming double gameweek run — ${bestDgwTeams} teams have two fixtures.`;
          } else {
            reasoning = 'Good strategic window to overhaul your squad before fixtures swing.';
          }
          break;
      }
    }

    // Set 1 chips are void after the GW19 deadline, so surface urgency.
    if (expiringSoon) {
      const gwWord = gameweeksRemaining === 1 ? 'gameweek' : 'gameweeks';
      reasoning = win.half === 1
        ? `Expires after GW${win.stop} — ${gameweeksRemaining} ${gwWord} left and cannot be carried into the second half. ${reasoning}`
        : `Only ${gameweeksRemaining} ${gwWord} left to use this chip. ${reasoning}`;
    }

    return {
      chip,
      chipLabel: chipLabels[chip] || chip,
      bestGameweek,
      score: best?.score ?? 0,
      reasoning,
      subLabel,
      gameweekScores,
      half: win.half,
      window: { start: win.start, stop: win.stop },
      expiringSoon,
      gameweeksRemaining,
    };
  });
}

// ═══════════════════════════════════════════════════════════════
// PRICE CHANGE PREDICTIONS
// ═══════════════════════════════════════════════════════════════

export interface PriceChange {
  player: FPLPlayer;
  team: FPLTeam;
  netTransfers: number;
  direction: 'rise' | 'fall';
  confidence: number; // 0-100
}

export function getPriceChangePredictions(
  players: FPLPlayer[],
  teams: FPLTeam[],
  topN: number = 20
): { risers: PriceChange[]; fallers: PriceChange[] } {
  const teamMap = new Map(teams.map(t => [t.id, t]));
  const threshold = 500_000;

  const withNet = players
    .filter(p => p.minutes > 0)
    .map(p => {
      const net = p.transfers_in_event - p.transfers_out_event;
      return {
        player: p,
        team: teamMap.get(p.team)!,
        netTransfers: net,
        direction: (net >= 0 ? 'rise' : 'fall') as 'rise' | 'fall',
        confidence: Math.min(100, Math.round((Math.abs(net) / threshold) * 100)),
      };
    });

  const risers = withNet
    .filter(p => p.netTransfers > 0)
    .sort((a, b) => b.netTransfers - a.netTransfers)
    .slice(0, topN);

  const fallers = withNet
    .filter(p => p.netTransfers < 0)
    .sort((a, b) => a.netTransfers - b.netTransfers)
    .slice(0, topN);

  return { risers, fallers };
}

// ═══════════════════════════════════════════════════════════════
// DIFFERENTIALS
// ═══════════════════════════════════════════════════════════════

export interface DifferentialPick {
  player: FPLPlayer;
  team: FPLTeam;
  score: number;
  ownership: number;
  reason: string;
}

export function getDifferentials(
  players: FPLPlayer[],
  teams: FPLTeam[],
  fixtures: FPLFixture[],
  events: FPLEvent[],
  maxOwnership: number = 10,
  topN: number = 10,
  historyMap?: PlayerHistoryMap
): DifferentialPick[] {
  const teamMap = new Map(teams.map(t => [t.id, t]));

  const eligible = players.filter(p => {
    const ownership = parseFloat(p.selected_by_percent);
    return ownership <= maxOwnership && p.status === 'a' && (p.minutes > 0 || (historyMap && historyMap[p.id]?.length > 0));
  });

  const scored = eligible.map(p => {
    const stats = getEffectiveStats(p, historyMap);
    const { form, ppg, ict } = stats;
    const ownership = parseFloat(p.selected_by_percent);

    const upcoming = getPlayerFixtures(p, fixtures, events, 3);
    const avgFDR = upcoming.length > 0
      ? upcoming.reduce((sum, f) => sum + f.difficulty, 0) / upcoming.length
      : 3;

    const score = form * 3.0 + ppg * 1.0 - avgFDR * 0.5 + ict * 0.01 - ownership * 0.1;

    const reasons: string[] = [];
    if (form > 5) reasons.push(`Strong form (${form})`);
    if (upcoming.some(f => f.difficulty <= 2)) reasons.push('Easy fixtures');
    if (p.penalties_order === 1) reasons.push('Penalty taker');
    if (stats.isHistorical && stats.totalPoints > 100) reasons.push(`${stats.totalPoints} pts last season`);
    reasons.push(`Only ${ownership}% owned`);

    return {
      player: p,
      team: teamMap.get(p.team)!,
      score,
      ownership,
      reason: reasons.join(' | '),
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}

// ═══════════════════════════════════════════════════════════════
// SQUAD BUILDER
// ═══════════════════════════════════════════════════════════════

export interface ScoreBreakdown {
  lastSeasonPts: number;
  lastSeasonPPG: number;
  lastSeasonGoals: number;
  lastSeasonAssists: number;
  lastSeasonCleanSheets: number;
  fixtureScore: number;
  avgFDR: number;
  fixtures: Array<{ opponent: string; isHome: boolean; difficulty: number; event: number }>;
  formScore: number;
  /** Total projected DefCon points across the modelled gameweeks. */
  defconScore: number;
  /** Defensive contribution points per 90. */
  defconPer90: number;
  /** Share of starts in which the CBIT/CBIRT threshold was cleared (0–1). */
  defconHitRate: number;
  bonusPerGame: number;
  setPiece: boolean;
  penaltyTaker: boolean;
  reasons: string[];
  isHistorical: boolean;
}

export interface SquadSlot {
  position: number; // 1-4
  player: FPLPlayer | null;
  team: FPLTeam | null;
  locked: boolean;
  score: number;
  breakdown: ScoreBreakdown | null;
}

export interface BuiltSquad {
  slots: SquadSlot[];
  totalCost: number;
  budget: number;
  remainingBudget: number;
  predictedPoints: number;
}

// ═══════════════════════════════════════════════════════════════
// xPts MODEL — Estimated FPL points per gameweek
// ═══════════════════════════════════════════════════════════════
// Instead of an abstract "score", this estimates actual FPL
// points a player would score across the next N gameweeks,
// based on the official FPL scoring system.

interface XPtsPerGW {
  event: number;
  xMinPts: number;      // appearance points (1 or 2)
  xGoalPts: number;     // position-adjusted goal points
  xAssistPts: number;   // assist points (3 each)
  xCSPts: number;       // clean sheet points by position
  xBonusPts: number;    // expected bonus points
  xDefconPts: number;   // defensive contribution points (+2 threshold bonus)
  xCardPts: number;     // yellow/red deductions
  xTotal: number;       // sum of all components
  opponent: string;
  isHome: boolean;
  difficulty: number;
}

function computeXPts(
  player: FPLPlayer,
  fixtures: FPLFixture[],
  events: FPLEvent[],
  teams: FPLTeam[],
  gameweeksAhead: number,
  historyMap?: PlayerHistoryMap
): { totalXPts: number; perGW: XPtsPerGW[]; breakdown: ScoreBreakdown } {
  const stats = getEffectiveStats(player, historyMap);
  const teamMap = new Map(teams.map(t => [t.id, t]));
  const pos = player.element_type;

  const { ppg, form, xg, xa, minutes, starts, bonus,
          totalPoints, goals, assists, cleanSheets, isHistorical } = stats;

  // ── Nailed-on confidence (the key filter) ──
  // How many games did they actually play a meaningful role in?
  // A full season is ~38 games. Players with <900 mins or <10 starts
  // are rotation/bench risks — their per-game rates are unreliable
  // AND they're unlikely to start regularly next season.
  const gamesPlayed = Math.max(1, starts);
  const minutesPlayed = Math.max(1, minutes);
  const avgMinutesPerApp = minutesPlayed / gamesPlayed;

  // Nailedness: what fraction of available games did they start?
  // Full season = 38 games. Scale: 0 = never plays, 1 = ever-present
  const FULL_SEASON_GAMES = 38;
  const startRate = Math.min(1, starts / FULL_SEASON_GAMES);

  // Was this player a regular starter or a sub/fringe player?
  // - 30+ starts (startRate > 0.79): nailed starter → full trust
  // - 20-29 starts: rotation risk → moderate trust
  // - 10-19 starts: fringe/sub → low trust, regress heavily
  // - <10 starts: cameo player → near-zero trust
  let nailedConfidence: number;
  if (starts >= 30) {
    nailedConfidence = 1.0;
  } else if (starts >= 20) {
    nailedConfidence = 0.75 + (starts - 20) * 0.025; // 0.75 → 1.0
  } else if (starts >= 10) {
    nailedConfidence = 0.35 + (starts - 10) * 0.04; // 0.35 → 0.75
  } else if (starts >= 5) {
    nailedConfidence = 0.10 + (starts - 5) * 0.05; // 0.10 → 0.35
  } else {
    nailedConfidence = starts * 0.02; // 0 → 0.10
  }

  // Also penalise players who mostly came on as subs (low avg mins)
  // A starter averages 75-90 min, a sub averages 15-30 min
  const subPenalty = avgMinutesPerApp < 45 ? 0.5 : avgMinutesPerApp < 60 ? 0.75 : 1.0;
  nailedConfidence *= subPenalty;

  // ── Bayesian shrinkage for per-game rates ──
  // With small samples, regress toward league-average rates.
  // The more starts, the more we trust the player's actual rate.
  // Prior: league-average rates by position
  const PRIOR_GOALS: Record<number, number> = { 1: 0.0, 2: 0.05, 3: 0.12, 4: 0.25 };
  const PRIOR_ASSISTS: Record<number, number> = { 1: 0.01, 2: 0.06, 3: 0.10, 4: 0.08 };
  const PRIOR_CS: Record<number, number> = { 1: 0.30, 2: 0.30, 3: 0.30, 4: 0.0 };
  const PRIOR_BONUS: Record<number, number> = { 1: 0.3, 2: 0.3, 3: 0.4, 4: 0.35 };

  // Shrinkage weight: how much to trust actual data vs prior
  // With 30+ starts, trust data ~90%. With 5 starts, trust ~30%.
  const SHRINKAGE_SAMPLE = 20; // "worth" of prior in equivalent starts
  const dataWeight = gamesPlayed / (gamesPlayed + SHRINKAGE_SAMPLE);
  const priorWeight = 1 - dataWeight;

  const rawGoalsPerGame = goals / gamesPlayed;
  const rawAssistsPerGame = assists / gamesPlayed;
  const rawBonusPerGame = bonus / gamesPlayed;
  const rawCSPerGame = cleanSheets / gamesPlayed;

  // Shrunk rates: blend actual performance with position average
  const goalsPerGame = rawGoalsPerGame * dataWeight + (PRIOR_GOALS[pos] ?? 0.1) * priorWeight;
  const assistsPerGame = rawAssistsPerGame * dataWeight + (PRIOR_ASSISTS[pos] ?? 0.08) * priorWeight;
  const bonusPerGame = rawBonusPerGame * dataWeight + (PRIOR_BONUS[pos] ?? 0.3) * priorWeight;
  const csPerGame = rawCSPerGame * dataWeight + (PRIOR_CS[pos] ?? 0.2) * priorWeight;

  // xG/xA per game as secondary signal
  const xgPerGame = (xg / Math.max(1, minutesPlayed)) * 90;
  const xaPerGame = (xa / Math.max(1, minutesPlayed)) * 90;

  // Blended goal/assist rate: 60% actual (shrunk), 40% xG/xA
  const blendedGoalsPerGame = goalsPerGame * 0.6 + xgPerGame * 0.4;
  const blendedAssistsPerGame = assistsPerGame * 0.6 + xaPerGame * 0.4;

  // Penalties add a reliable goal source on top
  const isPenaltyTaker = player.penalties_order === 1;
  const isSetPiece = (player.corners_and_indirect_freekicks_order === 1 ||
                      player.direct_freekicks_order === 1);
  const penaltyGoalsPerGame = isPenaltyTaker ? 0.08 : 0;

  // ── Starting probability for next season ──
  // This is the crux: a player's xPts should reflect whether
  // they'll actually be on the pitch. nailedConfidence captures
  // last season's playing time; startRate estimates probability.
  const probPlays = Math.min(0.95, startRate * 1.1); // cap at 95%
  const prob60Plus = probPlays * (avgMinutesPerApp >= 60 ? 0.85 : avgMinutesPerApp >= 30 ? 0.40 : 0.15);
  const prob1to59 = probPlays - prob60Plus;

  // Defensive contribution rate (points per 90).
  // Shrunk toward zero for small samples, same as the other rate stats,
  // so a defender with one big DefCon match doesn't get over-rewarded.
  const defconBasePer90 = defconPointsPer90(player) * dataWeight;

  // Card rate
  const yellowsPerGame = isHistorical
    ? 0.08
    : (player.yellow_cards / Math.max(1, gamesPlayed));
  const redsPerGame = isHistorical
    ? 0.003
    : (player.red_cards / Math.max(1, gamesPlayed));

  // ── Calculate xPts per gameweek ──
  const playerFixtures = getPlayerFixtures(player, fixtures, events, gameweeksAhead);
  const perGW: XPtsPerGW[] = [];
  let totalXPts = 0;
  const fixtureDetails: ScoreBreakdown['fixtures'] = [];

  // Decay: weight earlier GWs more (GW1=1.0, GW5=0.6)
  const gwDecay = [1.0, 0.95, 0.85, 0.75, 0.65];

  for (let i = 0; i < gameweeksAhead; i++) {
    const pf = playerFixtures[i];
    if (!pf) continue;

    const fdr = pf.difficulty;
    const homeBoost = pf.isHome ? 1.12 : 0.92;
    const attackMod = (FDR_ATTACK_MOD[fdr] ?? 1.0) * homeBoost;
    const defMod = (FDR_DEFENCE_MOD[fdr] ?? 1.0) * homeBoost;
    const decay = gwDecay[i] ?? 0.6;

    const opponentId = pf.isHome ? pf.fixture.team_a : pf.fixture.team_h;
    fixtureDetails.push({
      opponent: teamMap.get(opponentId)?.short_name ?? '???',
      isHome: pf.isHome,
      difficulty: fdr,
      event: pf.event,
    });

    // Appearance points
    const xMinPts = prob60Plus * 2 + prob1to59 * 1;

    // Goal points (adjusted by fixture + position scoring)
    const adjGoalsPerGame = (blendedGoalsPerGame + penaltyGoalsPerGame) * attackMod;
    const xGoalPts = adjGoalsPerGame * GOALS_POINTS[pos];

    // Assist points (adjusted by fixture)
    // Set piece takers get an assist boost (~0.05 extra per game)
    const setPieceAssistBoost = isSetPiece ? 0.04 : 0;
    const adjAssistsPerGame = (blendedAssistsPerGame + setPieceAssistBoost) * attackMod;
    const xAssistPts = adjAssistsPerGame * 3;

    // Clean sheet points (GKP/DEF get 4, MID gets 1, FWD gets 0)
    const adjCSRate = csPerGame * defMod;
    const xCSPts = adjCSRate * CS_POINTS[pos];

    // Bonus points
    const xBonusPts = bonusPerGame * (prob60Plus + prob1to59);

    // Defensive contribution points (+2 on clearing the CBIT/CBIRT threshold).
    // Scales with minutes played, and rises slightly against stronger opponents
    // since trailing/pressed teams rack up more defensive actions.
    const defconOpponentMod = fdr >= 4 ? 1.08 : fdr <= 2 ? 0.94 : 1.0;
    const xDefconPts = defconBasePer90 * (prob60Plus + prob1to59 * 0.5) * defconOpponentMod;

    // Card deductions
    const xCardPts = yellowsPerGame * 1 + redsPerGame * 3;

    const gwXPts = (xMinPts + xGoalPts + xAssistPts + xCSPts + xBonusPts + xDefconPts - xCardPts) * decay;

    perGW.push({
      event: pf.event,
      xMinPts: xMinPts * decay,
      xGoalPts: xGoalPts * decay,
      xAssistPts: xAssistPts * decay,
      xCSPts: xCSPts * decay,
      xBonusPts: xBonusPts * decay,
      xDefconPts: xDefconPts * decay,
      xCardPts: xCardPts * decay,
      xTotal: gwXPts,
      opponent: teamMap.get(opponentId)?.short_name ?? '???',
      isHome: pf.isHome,
      difficulty: fdr,
    });

    totalXPts += gwXPts;
  }

  // Apply injury penalty to total
  totalXPts += getInjuryPenalty(player);

  // If no fixtures found, estimate from PPG alone
  if (perGW.length === 0) {
    totalXPts = ppg * gameweeksAhead * 0.3; // heavily discounted
  }

  // ── Nailed-on confidence multiplier ──
  // This is the key: even if a fringe player's per-game rates look
  // good, their total xPts is crushed because they won't start.
  // A player with 3 starts last season (nailedConfidence ~0.06)
  // gets ~6% of the xPts of an ever-present with the same rates.
  totalXPts *= nailedConfidence;

  // ── Build avg FDR ──
  const avgFDR = fixtureDetails.length > 0
    ? fixtureDetails.reduce((s, f) => s + f.difficulty, 0) / fixtureDetails.length
    : 3;

  // ── Build human-readable reasons ──
  const reasons: string[] = [];

  // Nailedness indicator first — most important signal
  if (starts >= 30) {
    reasons.push(`Nailed starter (${starts} starts)`);
  } else if (starts >= 20) {
    reasons.push(`Regular starter (${starts} starts)`);
  } else if (starts >= 10) {
    reasons.push(`Rotation risk (${starts} starts)`);
  } else {
    reasons.push(`Fringe player (${starts} starts, ${minutesPlayed} mins)`);
  }

  if (isHistorical) {
    reasons.push(`${totalPoints} pts last season (${ppg.toFixed(1)} PPG)`);
    if (goals >= 10) reasons.push(`${goals} goals`);
    else if (goals > 0) reasons.push(`${goals} goals`);
    if (assists >= 5) reasons.push(`${assists} assists`);
    else if (assists > 0) reasons.push(`${assists} assists`);
    if (cleanSheets > 5 && (pos === 1 || pos === 2)) {
      reasons.push(`${cleanSheets} clean sheets`);
    }
  } else {
    if (form > 5) reasons.push(`Strong form (${form})`);
    if (ppg > 5) reasons.push(`${ppg.toFixed(1)} PPG`);
    if (goals > 5) reasons.push(`${goals} goals this season`);
  }

  // xPts per GW as headline
  const xPtsPerGW = perGW.length > 0 ? totalXPts / perGW.length : 0;
  if (xPtsPerGW > 4) reasons.push(`~${xPtsPerGW.toFixed(1)} xPts/GW`);

  if (avgFDR <= 2.2) reasons.push('Excellent fixtures');
  else if (avgFDR <= 2.8) reasons.push('Good fixtures');
  else if (avgFDR >= 3.8) reasons.push('Tough fixtures');

  if (isPenaltyTaker) reasons.push('Penalty taker');
  if (isSetPiece) reasons.push('Set piece taker');
  if (rawBonusPerGame > 1) reasons.push(`${rawBonusPerGame.toFixed(1)} bonus/game`);

  const defconRate = defconPointsPer90(player);
  const defconHit = defconHitRate(player);
  if (defconRate >= 1.4) reasons.push(`DefCon machine (${Math.round(defconHit * 100)}% of starts)`);
  else if (defconRate >= 0.8) reasons.push(`Regular DefCon (${defconRate.toFixed(1)}/90)`);

  const ownership = parseFloat(player.selected_by_percent);
  if (ownership > 30) reasons.push(`Template (${ownership}% owned)`);
  else if (ownership < 5 && starts >= 15) reasons.push(`Differential (${ownership}% owned)`);

  const fixtureScore = perGW.reduce((s, gw) => s + gw.xGoalPts + gw.xAssistPts + gw.xCSPts, 0);
  const performanceScore = perGW.reduce((s, gw) => s + gw.xMinPts + gw.xBonusPts, 0);
  const defconScore = perGW.reduce((s, gw) => s + gw.xDefconPts, 0);

  return {
    totalXPts,
    perGW,
    breakdown: {
      lastSeasonPts: isHistorical ? totalPoints : 0,
      lastSeasonPPG: ppg,
      lastSeasonGoals: goals,
      lastSeasonAssists: assists,
      lastSeasonCleanSheets: cleanSheets,
      fixtureScore,
      avgFDR,
      fixtures: fixtureDetails,
      formScore: performanceScore,
      defconScore,
      defconPer90: defconRate,
      defconHitRate: defconHit,
      bonusPerGame,
      setPiece: isSetPiece,
      penaltyTaker: isPenaltyTaker,
      reasons,
      isHistorical,
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// MODEL BENCHMARK — our xPts vs FPL's own ep_next
// FPL publishes its internal expected-points figure for the coming
// gameweek. Comparing ours against theirs is a useful credibility
// check, and the disagreements are where the insight lives.
// ═══════════════════════════════════════════════════════════════

export interface ModelComparison {
  player: FPLPlayer;
  team: FPLTeam;
  /** Our projected points for the next gameweek. */
  ourXPts: number;
  /** FPL's published expected points for the next gameweek. */
  fplEpNext: number;
  /** ourXPts − fplEpNext. Positive means we're more bullish. */
  delta: number;
  direction: 'bullish' | 'bearish';
}

/**
 * Compare our single-gameweek projection against FPL's `ep_next`.
 *
 * Restricted to players with a real chance of featuring — comparing
 * projections for deep squad players is noise, not signal.
 */
export function getModelComparisons(
  players: FPLPlayer[],
  teams: FPLTeam[],
  fixtures: FPLFixture[],
  events: FPLEvent[],
  options: { minOwnership?: number; limit?: number } = {},
  historyMap?: PlayerHistoryMap
): ModelComparison[] {
  const { minOwnership = 1, limit = 200 } = options;
  const teamMap = new Map(teams.map(t => [t.id, t]));

  const candidates = players
    .filter(p => p.status === 'a' || p.status === 'd')
    .filter(p => parseFloat(p.selected_by_percent) >= minOwnership)
    .filter(p => parseFloat(p.ep_next || '0') > 0)
    .sort((a, b) => parseFloat(b.selected_by_percent) - parseFloat(a.selected_by_percent))
    .slice(0, limit);

  const results: ModelComparison[] = [];

  for (const player of candidates) {
    const team = teamMap.get(player.team);
    if (!team) continue;

    const { totalXPts } = computeXPts(player, fixtures, events, teams, 1, historyMap);
    const fplEpNext = parseFloat(player.ep_next || '0');
    const delta = totalXPts - fplEpNext;

    results.push({
      player,
      team,
      ourXPts: totalXPts,
      fplEpNext,
      delta,
      direction: delta >= 0 ? 'bullish' : 'bearish',
    });
  }

  return results.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

// ═══════════════════════════════════════════════════════════════
// PRE-SEASON
// Before GW1 the personalised stats FPL returns are all empty
// (no average scores, no most-captained, no manager history), so
// the dashboard needs different content in this window.
// ═══════════════════════════════════════════════════════════════

/** True when the season hasn't kicked off yet. */
export function isPreSeason(events: FPLEvent[]): boolean {
  const first = events.find(e => e.id === 1);
  const anyFinished = events.some(e => e.finished);
  return !anyFinished && !!first && !first.finished;
}

/** Days until the given deadline, floored at 0. */
export function daysUntil(deadlineIso: string): number {
  const ms = new Date(deadlineIso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export interface NewSigning {
  player: FPLPlayer;
  team: FPLTeam;
  joined: Date;
}

/**
 * Players who joined their current club most recently.
 * Relevant pre-season, when new arrivals have no FPL history to judge them by.
 */
export function getNewSignings(
  players: FPLPlayer[],
  teams: FPLTeam[],
  limit = 8,
  withinDays = 120
): NewSigning[] {
  const teamMap = new Map(teams.map(t => [t.id, t]));
  const cutoff = Date.now() - withinDays * 24 * 60 * 60 * 1000;

  return players
    .filter(p => p.team_join_date)
    .map(p => {
      const team = teamMap.get(p.team);
      if (!team) return null;
      const joined = new Date(p.team_join_date!);
      if (isNaN(joined.getTime()) || joined.getTime() < cutoff) return null;
      return { player: p, team, joined };
    })
    .filter((s): s is NewSigning => s !== null)
    // Surface the ones people will actually consider, not fringe squad additions.
    .sort((a, b) => {
      const costDiff = b.player.now_cost - a.player.now_cost;
      if (costDiff !== 0) return costDiff;
      return b.joined.getTime() - a.joined.getTime();
    })
    .slice(0, limit);
}

export interface TemplatePick {
  player: FPLPlayer;
  team: FPLTeam;
  ownership: number;
}

/**
 * The most-owned players by position — the "template" squad that most
 * managers start the season with.
 */
export function getTemplatePicks(
  players: FPLPlayer[],
  teams: FPLTeam[],
  perPosition = 3
): Record<number, TemplatePick[]> {
  const teamMap = new Map(teams.map(t => [t.id, t]));
  const byPos: Record<number, TemplatePick[]> = { 1: [], 2: [], 3: [], 4: [] };

  for (const player of players) {
    const team = teamMap.get(player.team);
    if (!team) continue;
    if (getAvailability(player).withdrawn) continue;
    const bucket = byPos[player.element_type];
    if (!bucket) continue;
    bucket.push({ player, team, ownership: parseFloat(player.selected_by_percent) || 0 });
  }

  for (const pos of Object.keys(byPos)) {
    const key = Number(pos);
    byPos[key] = byPos[key]
      .sort((a, b) => b.ownership - a.ownership)
      .slice(0, perPosition);
  }

  return byPos;
}

export interface OpeningRun {
  team: FPLTeam;
  avgDifficulty: number;
  fixtures: Array<{ event: number; opponent: string; isHome: boolean; difficulty: number }>;
}

/**
 * Opening-fixture difficulty from GW1, for deciding where to invest
 * before a ball has been kicked.
 */
export function getOpeningRuns(
  teams: FPLTeam[],
  fixtures: FPLFixture[],
  gameweeks = 5
): OpeningRun[] {
  const teamMap = new Map(teams.map(t => [t.id, t]));
  const targetGWs = Array.from({ length: gameweeks }, (_, i) => i + 1);

  return teams
    .map(team => {
      const runs = fixtures
        .filter(f => f.event !== null && targetGWs.includes(f.event) && (f.team_h === team.id || f.team_a === team.id))
        .map(f => {
          const isHome = f.team_h === team.id;
          const opponentId = isHome ? f.team_a : f.team_h;
          return {
            event: f.event!,
            opponent: teamMap.get(opponentId)?.short_name ?? '???',
            isHome,
            difficulty: isHome ? f.team_h_difficulty : f.team_a_difficulty,
          };
        })
        .sort((a, b) => a.event - b.event);

      const avg = runs.length > 0
        ? runs.reduce((s, f) => s + f.difficulty, 0) / runs.length
        : 0;

      return { team, avgDifficulty: avg, fixtures: runs };
    })
    .filter(r => r.fixtures.length > 0)
    .sort((a, b) => a.avgDifficulty - b.avgDifficulty);
}

// ═══════════════════════════════════════════════════════════════
// FIXTURE PLANNER
// A ticker shows difficulty; a planner answers "what do I do about it".
// Three questions: who has the best run, whose run is about to swing,
// and which cheap pairs cover each other's bad weeks.
// ═══════════════════════════════════════════════════════════════

export interface PlannerFixture {
  event: number;
  opponent: string;
  isHome: boolean;
  difficulty: number;
}

export interface PlannerRow {
  team: FPLTeam;
  fixtures: PlannerFixture[];
  /** Mean FDR across the horizon (lower is easier). */
  avgDifficulty: number;
  /** Count of fixtures at FDR <= 2. */
  easyCount: number;
  /** Count of fixtures at FDR >= 4. */
  hardCount: number;
  /** Gameweeks in the horizon with no fixture (blanks). */
  blanks: number[];
  /** Gameweeks in the horizon with two or more fixtures (doubles). */
  doubles: number[];
}

/**
 * Build a fixture grid over an arbitrary gameweek window.
 * Unlike the dashboard ticker this handles blanks and doubles explicitly,
 * which is what makes it usable for planning rather than just glancing.
 */
export function buildFixturePlanner(
  teams: FPLTeam[],
  fixtures: FPLFixture[],
  startEvent: number,
  horizon: number
): PlannerRow[] {
  const teamMap = new Map(teams.map(t => [t.id, t]));
  const targetGWs = Array.from({ length: horizon }, (_, i) => startEvent + i).filter(gw => gw <= 38);

  return teams
    .map(team => {
      const rows: PlannerFixture[] = [];
      const byGW = new Map<number, number>();

      for (const f of fixtures) {
        if (f.event === null || !targetGWs.includes(f.event)) continue;
        const isHome = f.team_h === team.id;
        const isAway = f.team_a === team.id;
        if (!isHome && !isAway) continue;

        const opponentId = isHome ? f.team_a : f.team_h;
        rows.push({
          event: f.event,
          opponent: teamMap.get(opponentId)?.short_name ?? '???',
          isHome,
          difficulty: isHome ? f.team_h_difficulty : f.team_a_difficulty,
        });
        byGW.set(f.event, (byGW.get(f.event) ?? 0) + 1);
      }

      rows.sort((a, b) => a.event - b.event);

      const avg = rows.length > 0
        ? rows.reduce((s, f) => s + f.difficulty, 0) / rows.length
        : 0;

      return {
        team,
        fixtures: rows,
        avgDifficulty: avg,
        easyCount: rows.filter(f => f.difficulty <= 2).length,
        hardCount: rows.filter(f => f.difficulty >= 4).length,
        blanks: targetGWs.filter(gw => !byGW.has(gw)),
        doubles: targetGWs.filter(gw => (byGW.get(gw) ?? 0) > 1),
      };
    })
    .sort((a, b) => a.avgDifficulty - b.avgDifficulty);
}

export interface FixtureSwing {
  team: FPLTeam;
  /** Mean FDR over the near window. */
  nearAvg: number;
  /** Mean FDR over the window that follows. */
  farAvg: number;
  /** nearAvg − farAvg. Positive = fixtures improve. */
  swing: number;
  direction: 'improving' | 'worsening';
}

/**
 * Teams whose fixture difficulty changes sharply between two consecutive
 * windows — the basis of "buy early / sell before the turn" decisions.
 */
export function getFixtureSwings(
  teams: FPLTeam[],
  fixtures: FPLFixture[],
  startEvent: number,
  windowSize = 4,
  minSwing = 0.5
): FixtureSwing[] {
  const near = buildFixturePlanner(teams, fixtures, startEvent, windowSize);
  const far = buildFixturePlanner(teams, fixtures, startEvent + windowSize, windowSize);
  const farMap = new Map(far.map(r => [r.team.id, r]));

  return teams
    .map(team => {
      const n = near.find(r => r.team.id === team.id);
      const f = farMap.get(team.id);
      if (!n || !f || n.fixtures.length === 0 || f.fixtures.length === 0) return null;

      const swing = n.avgDifficulty - f.avgDifficulty;
      return {
        team,
        nearAvg: n.avgDifficulty,
        farAvg: f.avgDifficulty,
        swing,
        direction: swing > 0 ? ('improving' as const) : ('worsening' as const),
      };
    })
    .filter((s): s is FixtureSwing => s !== null && Math.abs(s.swing) >= minSwing)
    .sort((a, b) => Math.abs(b.swing) - Math.abs(a.swing));
}

export interface RotationPair {
  teamA: FPLTeam;
  teamB: FPLTeam;
  /**
   * Mean of the best fixture available each gameweek — i.e. what you'd score
   * on difficulty if you always started whichever of the two had the kinder tie.
   */
  combinedAvg: number;
  /** How much better the pair is than the stronger team alone. */
  improvement: number;
  /** Per-gameweek record of which team you'd field. */
  weeks: Array<{ event: number; pick: 'A' | 'B' | 'none'; difficulty: number }>;
}

/**
 * Find team pairs whose fixtures complement each other — when one has a hard
 * week the other has an easy one. Playing the better fixture each week yields
 * a smoother run than either team alone.
 */
export function getRotationPairs(
  teams: FPLTeam[],
  fixtures: FPLFixture[],
  startEvent: number,
  horizon = 6,
  limit = 8
): RotationPair[] {
  const planner = buildFixturePlanner(teams, fixtures, startEvent, horizon);
  const byTeam = new Map(planner.map(r => [r.team.id, r]));
  const targetGWs = Array.from({ length: horizon }, (_, i) => startEvent + i).filter(gw => gw <= 38);

  /** Easiest fixture a team has in a given gameweek, or null if blank. */
  function bestIn(row: PlannerRow | undefined, gw: number): number | null {
    if (!row) return null;
    const inGW = row.fixtures.filter(f => f.event === gw);
    if (inGW.length === 0) return null;
    return Math.min(...inGW.map(f => f.difficulty));
  }

  const pairs: RotationPair[] = [];

  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      const rowA = byTeam.get(teams[i].id);
      const rowB = byTeam.get(teams[j].id);
      if (!rowA || !rowB) continue;

      const weeks: RotationPair['weeks'] = [];
      let total = 0;
      let counted = 0;

      for (const gw of targetGWs) {
        const a = bestIn(rowA, gw);
        const b = bestIn(rowB, gw);

        if (a === null && b === null) {
          weeks.push({ event: gw, pick: 'none', difficulty: 0 });
          continue;
        }
        const pick = a === null ? 'B' : b === null ? 'A' : (a <= b ? 'A' : 'B');
        const difficulty = pick === 'A' ? (a as number) : (b as number);
        weeks.push({ event: gw, pick, difficulty });
        total += difficulty;
        counted++;
      }

      if (counted === 0) continue;
      const combinedAvg = total / counted;
      const soloBest = Math.min(rowA.avgDifficulty, rowB.avgDifficulty);

      pairs.push({
        teamA: teams[i],
        teamB: teams[j],
        combinedAvg,
        improvement: soloBest - combinedAvg,
        weeks,
      });
    }
  }

  return pairs
    // A useful pair must actually beat holding the better team on its own.
    .filter(p => p.improvement > 0.15)
    .sort((a, b) => a.combinedAvg - b.combinedAvg)
    .slice(0, limit);
}

export function buildOptimalSquad(
  players: FPLPlayer[],
  teams: FPLTeam[],
  fixtures: FPLFixture[],
  events: FPLEvent[],
  lockedPlayers: Array<{ id: number; position: number }>,
  budget: number = 1000,
  historyMap?: PlayerHistoryMap
): BuiltSquad {
  const teamMap = new Map(teams.map(t => [t.id, t]));
  const playerMap = new Map(players.map(p => [p.id, p]));
  const GW_AHEAD = 5;

  const positionSlots: Record<number, number> = { 1: 2, 2: 5, 3: 5, 4: 3 };

  // ── Step 1: Compute xPts for all eligible players ──
  // Minimum starts threshold: exclude fringe/cameo players.
  // The nailedConfidence multiplier already penalises low-start players,
  // but filtering them out entirely avoids wasting compute on 400+
  // players who'll never be picked and keeps the pool realistic.
  const MIN_STARTS_THRESHOLD = 5; // at least 5 starts last season
  const eligible = players.filter(p => {
    if (p.status !== 'a') return false;

    // Check current season data
    if (p.minutes > 0 && p.starts >= MIN_STARTS_THRESHOLD) return true;

    // Check historical data
    const history = historyMap?.[p.id];
    if (history && history.length > 0) {
      const lastSeason = history[history.length - 1];
      return lastSeason.starts >= MIN_STARTS_THRESHOLD;
    }

    return false;
  });

  const playerXPts = new Map<number, { xPts: number; breakdown: ScoreBreakdown }>();
  for (const p of eligible) {
    const result = computeXPts(p, fixtures, events, teams, GW_AHEAD, historyMap);
    playerXPts.set(p.id, { xPts: result.totalXPts, breakdown: result.breakdown });
  }

  // ── Step 2: Place locked players ──
  const slots: SquadSlot[] = [];
  const usedPlayerIds = new Set<number>();
  const teamCounts = new Map<number, number>();
  let usedBudget = 0;

  for (const locked of lockedPlayers) {
    const player = playerMap.get(locked.id);
    if (!player) continue;
    usedPlayerIds.add(player.id);
    usedBudget += player.now_cost;
    teamCounts.set(player.team, (teamCounts.get(player.team) || 0) + 1);
    const data = playerXPts.get(player.id);
    slots.push({
      position: player.element_type,
      player,
      team: teamMap.get(player.team) || null,
      locked: true,
      score: data?.xPts ?? 0,
      breakdown: data?.breakdown ?? null,
    });
  }

  const filledPositions: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const slot of slots) {
    filledPositions[slot.position] = (filledPositions[slot.position] || 0) + 1;
  }

  // ── Step 3: Lagrangian-based selection ──
  //
  // Classic 0-1 knapsack: maximise total xPts subject to budget.
  // Full ILP is NP-hard, but the Lagrangian relaxation trick works
  // well: for a "price of a point" lambda, each player's adjusted
  // value is (xPts - lambda * cost). We binary-search for the
  // lambda that produces a feasible squad near budget.
  //
  // This naturally selects premium players (Haaland's 35 xPts
  // easily overcomes his cost penalty) while still finding budget
  // enablers for bench slots.

  const availablePlayers = eligible
    .filter(p => !usedPlayerIds.has(p.id))
    .map(p => ({
      player: p,
      xPts: playerXPts.get(p.id)?.xPts ?? 0,
      breakdown: playerXPts.get(p.id)?.breakdown ?? null,
    }));

  // Count total remaining slots to fill
  let totalSlotsNeeded = 0;
  for (const pos of [1, 2, 3, 4]) {
    totalSlotsNeeded += positionSlots[pos] - filledPositions[pos];
  }

  const remainingBudget = budget - usedBudget;

  // Binary search for optimal lambda
  let bestSquadPicks: Array<{ player: FPLPlayer; xPts: number; breakdown: ScoreBreakdown | null }> = [];
  let bestTotalXPts = -1;

  // Try a range of lambda values (price per xPt point)
  // Lower lambda = favours expensive high-xPts players
  // Higher lambda = favours cheap players
  const lambdaValues = [0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 7.0, 10.0, 15.0, 20.0];

  for (const lambda of lambdaValues) {
    const picks = greedyFillWithLambda(
      availablePlayers,
      positionSlots,
      filledPositions,
      teamCounts,
      remainingBudget,
      lambda
    );

    if (!picks) continue;

    const totalXPts = picks.reduce((s, p) => s + p.xPts, 0);
    const totalCost = picks.reduce((s, p) => s + p.player.now_cost, 0);

    // Must be within budget and fill all slots
    if (totalCost <= remainingBudget && picks.length === totalSlotsNeeded && totalXPts > bestTotalXPts) {
      bestTotalXPts = totalXPts;
      bestSquadPicks = picks;
    }
  }

  // ── Step 4: Assemble final squad ──
  for (const pick of bestSquadPicks) {
    const count = teamCounts.get(pick.player.team) || 0;
    teamCounts.set(pick.player.team, count + 1);
    usedBudget += pick.player.now_cost;
    slots.push({
      position: pick.player.element_type,
      player: pick.player,
      team: teamMap.get(pick.player.team) || null,
      locked: false,
      score: pick.xPts,
      breakdown: pick.breakdown,
    });
  }

  // Fill any unfilled slots with empty
  for (const pos of [1, 2, 3, 4]) {
    const currentFilled = slots.filter(s => s.position === pos).length;
    for (let i = currentFilled; i < positionSlots[pos]; i++) {
      slots.push({ position: pos, player: null, team: null, locked: false, score: 0, breakdown: null });
    }
  }

  // ── Step 5: Post-optimization — pairwise swaps ──
  // Try swapping each non-locked player with a same-position alternative
  // to squeeze out more xPts within budget
  const nonLockedIndices = slots
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => !s.locked && s.player)
    .map(({ i }) => i);

  for (const idx of nonLockedIndices) {
    const currentSlot = slots[idx];
    if (!currentSlot.player) continue;

    const currentCost = currentSlot.player.now_cost;
    const currentXPts = currentSlot.score;
    const totalCostNow = slots.reduce((s, sl) => s + (sl.player?.now_cost ?? 0), 0);
    const headroom = budget - totalCostNow + currentCost;

    // Find a better same-position player we're not already using
    const usedIds = new Set(slots.filter(s => s.player).map(s => s.player!.id));
    const localTeamCounts = new Map<number, number>();
    for (const s of slots) {
      if (s.player && s.player.id !== currentSlot.player.id) {
        localTeamCounts.set(s.player.team, (localTeamCounts.get(s.player.team) || 0) + 1);
      }
    }

    let bestSwap: { player: FPLPlayer; xPts: number; breakdown: ScoreBreakdown | null } | null = null;

    for (const ap of availablePlayers) {
      if (usedIds.has(ap.player.id)) continue;
      if (ap.player.element_type !== currentSlot.position) continue;
      if (ap.player.now_cost > headroom) continue;
      if ((localTeamCounts.get(ap.player.team) || 0) >= 3) continue;
      if (ap.xPts <= currentXPts) continue; // must be strictly better

      if (!bestSwap || ap.xPts > bestSwap.xPts) {
        bestSwap = ap;
      }
    }

    if (bestSwap) {
      slots[idx] = {
        position: currentSlot.position,
        player: bestSwap.player,
        team: teamMap.get(bestSwap.player.team) || null,
        locked: false,
        score: bestSwap.xPts,
        breakdown: bestSwap.breakdown,
      };
    }
  }

  slots.sort((a, b) => a.position - b.position || (b.locked ? 1 : 0) - (a.locked ? 1 : 0));

  const totalCost = slots.reduce((sum, s) => sum + (s.player?.now_cost || 0), 0);
  const predictedPoints = slots.reduce((sum, s) => sum + s.score, 0);

  return {
    slots,
    totalCost,
    budget,
    remainingBudget: budget - totalCost,
    predictedPoints,
  };
}

/**
 * Greedy fill using Lagrangian adjusted value: xPts - lambda * cost
 * This balances absolute quality against budget efficiency.
 */
function greedyFillWithLambda(
  available: Array<{ player: FPLPlayer; xPts: number; breakdown: ScoreBreakdown | null }>,
  positionSlots: Record<number, number>,
  filledPositions: Record<number, number>,
  existingTeamCounts: Map<number, number>,
  remainingBudget: number,
  lambda: number
): Array<{ player: FPLPlayer; xPts: number; breakdown: ScoreBreakdown | null }> | null {
  // Sort by adjusted value
  const sorted = [...available]
    .map(p => ({
      ...p,
      adjustedValue: p.xPts - lambda * (p.player.now_cost / 10),
    }))
    .sort((a, b) => b.adjustedValue - a.adjustedValue);

  const picks: Array<{ player: FPLPlayer; xPts: number; breakdown: ScoreBreakdown | null }> = [];
  const usedIds = new Set<number>();
  const teamCounts = new Map(existingTeamCounts);
  const posFilled = { ...filledPositions };
  let budgetLeft = remainingBudget;

  // Count total needed
  let totalNeeded = 0;
  for (const pos of [1, 2, 3, 4]) {
    totalNeeded += positionSlots[pos] - posFilled[pos];
  }

  // Reserve minimum cost for unfilled positions as we go
  function reserveForRemaining(): number {
    let reserve = 0;
    for (const pos of [1, 2, 3, 4]) {
      const stillNeeded = positionSlots[pos] - posFilled[pos];
      // Cheapest player at each position is roughly £4.0m = 40
      reserve += stillNeeded * 40;
    }
    return reserve;
  }

  // First pass: fill each position
  for (const pos of [1, 2, 3, 4]) {
    const needed = positionSlots[pos] - posFilled[pos];
    let filled = 0;

    for (const sp of sorted) {
      if (filled >= needed) break;
      if (sp.player.element_type !== pos) continue;
      if (usedIds.has(sp.player.id)) continue;
      if ((teamCounts.get(sp.player.team) || 0) >= 3) continue;

      // Check budget feasibility: can we afford this + minimums for remaining?
      const tentativeBudget = budgetLeft - sp.player.now_cost;
      // Temporarily count this slot as filled
      posFilled[pos]++;
      const reserveNeeded = reserveForRemaining() - 40; // subtract one since we just filled
      posFilled[pos]--;

      if (tentativeBudget < reserveNeeded && tentativeBudget < 0) continue;
      if (sp.player.now_cost > budgetLeft) continue;

      // Additional budget check: ensure remaining budget can fill remaining slots
      const afterCost = budgetLeft - sp.player.now_cost;
      const slotsAfter = totalNeeded - picks.length - 1;
      if (slotsAfter > 0 && afterCost < slotsAfter * 40) continue;

      usedIds.add(sp.player.id);
      teamCounts.set(sp.player.team, (teamCounts.get(sp.player.team) || 0) + 1);
      budgetLeft -= sp.player.now_cost;
      posFilled[pos]++;
      filled++;
      picks.push(sp);
    }

    if (filled < needed) return null; // couldn't fill position
  }

  return picks;
}
