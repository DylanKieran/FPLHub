// Core FPL data types

export interface FPLPlayer {
  id: number;
  code: number;
  web_name: string;
  first_name: string;
  second_name: string;
  team: number;
  element_type: number; // 1=GKP, 2=DEF, 3=MID, 4=FWD
  now_cost: number; // in tenths of £m
  cost_change_start: number;
  cost_change_event: number;
  total_points: number;
  event_points: number;
  points_per_game: string;
  selected_by_percent: string;
  form: string;
  status: 'a' | 'i' | 'd' | 's' | 'u';
  chance_of_playing_next_round: number | null;
  chance_of_playing_this_round: number | null;
  news: string;
  news_added: string | null;
  minutes: number;
  goals_scored: number;
  assists: number;
  clean_sheets: number;
  goals_conceded: number;
  own_goals: number;
  penalties_saved: number;
  penalties_missed: number;
  yellow_cards: number;
  red_cards: number;
  saves: number;
  bonus: number;
  bps: number;
  influence: string;
  creativity: string;
  threat: string;
  ict_index: string;
  expected_goals: string;
  expected_assists: string;
  expected_goal_involvements: string;
  expected_goals_conceded: string;
  starts: number;
  ep_next: string | null;
  ep_this: string | null;
  value_form: string;
  value_season: string;
  transfers_in: number;
  transfers_out: number;
  transfers_in_event: number;
  transfers_out_event: number;
  corners_and_indirect_freekicks_order: number | null;
  direct_freekicks_order: number | null;
  penalties_order: number | null;
  dreamteam_count: number;
  in_dreamteam: boolean;

  // ── Defensive Contributions (DefCon) — introduced 2025/26, retained 2026/27 ──
  // DEF: +2 for 10+ CBIT. MID/FWD: +2 for 12+ CBIRT (CBIT + recoveries).
  defensive_contribution: number;
  defensive_contribution_per_90: number;
  clearances_blocks_interceptions: number;
  recoveries: number;
  tackles: number;

  // ── Per-90 rate stats ──
  expected_goals_per_90: number;
  expected_assists_per_90: number;
  expected_goal_involvements_per_90: number;
  expected_goals_conceded_per_90: number;
  goals_conceded_per_90: number;
  clean_sheets_per_90: number;
  saves_per_90: number;
  starts_per_90: number;

  // ── Pre-computed ranks (overall and within position) ──
  form_rank: number | null;
  form_rank_type: number | null;
  ict_index_rank: number | null;
  ict_index_rank_type: number | null;
  points_per_game_rank: number | null;
  points_per_game_rank_type: number | null;
  selected_rank: number | null;
  selected_rank_type: number | null;
  now_cost_rank: number | null;
  now_cost_rank_type: number | null;
  influence_rank: number | null;
  influence_rank_type: number | null;
  creativity_rank: number | null;
  creativity_rank_type: number | null;
  threat_rank: number | null;
  threat_rank_type: number | null;

  // ── Availability / transactability ──
  can_select: boolean;
  can_transact: boolean;
  removed: boolean;
  special: boolean;
  scout_risks: unknown[];
  scout_news_link: string;

  // ── Price movement ──
  price_change_percent: string;
  cost_change_event_fall: number;
  cost_change_start_fall: number;

  // ── Set-piece notes (human readable, accompany the *_order fields) ──
  penalties_text: string;
  direct_freekicks_text: string;
  corners_and_indirect_freekicks_text: string;

  // ── Squad metadata ──
  photo: string; // e.g. "154561.jpg" — see playerPhotoUrl()
  birth_date: string | null;
  team_join_date: string | null;
  squad_number: number | null;
  team_code: number;
  region: number | null;
  opta_code: string;
  known_name: string;
}

/**
 * Premier League player headshot URL.
 * The API exposes `photo` as "{code}.jpg" but the CDN serves PNGs keyed by code.
 */
export function playerPhotoUrl(
  player: Pick<FPLPlayer, 'code'>,
  size: '110x140' | '250x250' = '250x250'
): string {
  return `https://resources.premierleague.com/premierleague/photos/players/${size}/p${player.code}.png`;
}

export interface FPLTeam {
  id: number;
  code: number;
  name: string;
  short_name: string;
  strength: number | null;
  strength_overall_home: number;
  strength_overall_away: number;
  strength_attack_home: number;
  strength_attack_away: number;
  strength_defence_home: number;
  strength_defence_away: number;
  played: number;
  win: number;
  draw: number;
  loss: number;
  points: number;
  position: number;
  pulse_id: number;
}

export interface FPLEvent {
  id: number;
  name: string;
  deadline_time: string;
  deadline_time_epoch: number;
  average_entry_score: number;
  highest_score: number | null;
  finished: boolean;
  is_previous: boolean;
  is_current: boolean;
  is_next: boolean;
  chip_plays: Array<{ chip_name: string; num_played: number }>;
  most_selected: number | null;
  most_transferred_in: number | null;
  most_captained: number | null;
  top_element: number | null;
  top_element_info: { id: number; points: number } | null;
}

export interface FPLFixture {
  id: number;
  code: number;
  event: number | null;
  kickoff_time: string | null;
  finished: boolean;
  finished_provisional: boolean;
  started: boolean;
  minutes: number;
  team_h: number;
  team_a: number;
  team_h_score: number | null;
  team_a_score: number | null;
  team_h_difficulty: number;
  team_a_difficulty: number;
  stats: Array<{
    identifier: string;
    a: Array<{ value: number; element: number }>;
    h: Array<{ value: number; element: number }>;
  }>;
}

export interface FPLElementType {
  id: number;
  singular_name: string;
  plural_name: string;
  plural_name_short: string;
  squad_select: number;
  squad_min_play: number;
  squad_max_play: number;
}

/**
 * A chip and the gameweek window it may be played in.
 * 2026/27 ships TWO sets: set 1 covers GW1/2–19, set 2 covers GW20–38.
 * Set 1 chips expire at the GW19 deadline and cannot be carried over.
 */
export interface FPLChip {
  id: number;
  name: 'wildcard' | 'freehit' | 'bboost' | '3xc';
  number: number;
  start_event: number;
  stop_event: number;
  chip_type: string;
}

/** Season sub-periods (Overall, then month-by-month). */
export interface FPLPhase {
  id: number;
  name: string;
  start_event: number;
  stop_event: number;
  highest_score: number | null;
}

export interface FPLBootstrap {
  events: FPLEvent[];
  teams: FPLTeam[];
  elements: FPLPlayer[];
  element_types: FPLElementType[];
  total_players: number;
  game_settings: Record<string, unknown>;
  chips: FPLChip[];
  phases: FPLPhase[];
}

export interface FPLPick {
  element: number;
  position: number;
  multiplier: number;
  is_captain: boolean;
  is_vice_captain: boolean;
}

export interface FPLManagerPicks {
  active_chip: string | null;
  automatic_subs: Array<{ element_in: number; element_out: number; event: number }>;
  entry_history: {
    event: number;
    points: number;
    total_points: number;
    rank: number;
    overall_rank: number;
    bank: number;
    value: number;
    event_transfers: number;
    event_transfers_cost: number;
    points_on_bench: number;
  };
  picks: FPLPick[];
}

export interface FPLManagerHistory {
  current: Array<{
    event: number;
    points: number;
    total_points: number;
    rank: number;
    overall_rank: number;
    bank: number;
    value: number;
    event_transfers: number;
    event_transfers_cost: number;
    points_on_bench: number;
  }>;
  past: Array<{
    season_name: string;
    total_points: number;
    rank: number;
  }>;
  chips: Array<{
    name: string;
    time: string;
    event: number;
  }>;
}

export interface FPLManager {
  id: number;
  joined_time: string;
  started_event: number;
  player_first_name: string;
  player_last_name: string;
  name: string;
  summary_overall_points: number;
  summary_overall_rank: number;
  summary_event_points: number;
  summary_event_rank: number;
  current_event: number;
  leagues: {
    classic: Array<{ id: number; name: string; entry_rank: number }>;
    h2h: Array<{ id: number; name: string; entry_rank: number }>;
  };
}

export interface FPLTransfer {
  element_in: number;
  element_in_cost: number;
  element_out: number;
  element_out_cost: number;
  entry: number;
  event: number;
  time: string;
}

export interface FPLHistoryPast {
  season_name: string;
  element_code: number;
  start_cost: number;
  end_cost: number;
  total_points: number;
  minutes: number;
  goals_scored: number;
  assists: number;
  clean_sheets: number;
  goals_conceded: number;
  own_goals: number;
  penalties_saved: number;
  penalties_missed: number;
  yellow_cards: number;
  red_cards: number;
  saves: number;
  bonus: number;
  bps: number;
  influence: string;
  creativity: string;
  threat: string;
  ict_index: string;
  starts: number;
  expected_goals: string;
  expected_assists: string;
  expected_goal_involvements: string;
  expected_goals_conceded: string;
}

// Position mapping helper
export const POSITION_MAP: Record<number, string> = {
  1: 'GKP',
  2: 'DEF',
  3: 'MID',
  4: 'FWD',
};

export const POSITION_FULL: Record<number, string> = {
  1: 'Goalkeeper',
  2: 'Defender',
  3: 'Midfielder',
  4: 'Forward',
};

export const STATUS_MAP: Record<string, { label: string; color: string }> = {
  a: { label: 'Available', color: 'text-green-400' },
  i: { label: 'Injured', color: 'text-red-400' },
  d: { label: 'Doubtful', color: 'text-yellow-400' },
  s: { label: 'Suspended', color: 'text-orange-400' },
  u: { label: 'Unavailable', color: 'text-gray-400' },
};
