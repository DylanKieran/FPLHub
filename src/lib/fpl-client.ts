const FPL_BASE = 'https://fantasy.premierleague.com/api';
const CACHE = new Map<string, { data: unknown; expires: number }>();
const DEFAULT_TTL = 300_000; // 5 minutes

async function fetchFPL<T>(path: string, ttl = DEFAULT_TTL): Promise<T> {
  const url = `${FPL_BASE}${path}`;
  const cached = CACHE.get(url);
  if (cached && cached.expires > Date.now()) return cached.data as T;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'FPL-Analysis-App/1.0' },
    next: { revalidate: Math.floor(ttl / 1000) },
  });

  if (!res.ok) throw new Error(`FPL API error: ${res.status} ${res.statusText}`);
  const data = await res.json();
  CACHE.set(url, { data, expires: Date.now() + ttl });
  return data as T;
}

export async function getBootstrap() {
  return fetchFPL<import('@/types/fpl').FPLBootstrap>('/bootstrap-static/');
}

type Fixture = import('@/types/fpl').FPLFixture;

/**
 * Fetch fixtures for the CURRENT season.
 *
 * The unfiltered `/fixtures/` endpoint can serve a stale, CDN-cached copy of
 * the PREVIOUS season — observed on 29 Jul 2026, where it returned 2025/26
 * fixtures (kickoffs in Aug 2025, all `finished: true`) while `?event=N`
 * correctly returned 2026/27. Fixture ids are reused across seasons, so the
 * stale data is not obviously wrong; only `code` and `kickoff_time` differ.
 *
 * Since every fixture-driven feature (FDR, planner, captain picks, squad
 * builder) would silently use the wrong season, we validate the response
 * against the current season's GW1 deadline and fall back to a per-event
 * fetch when it looks stale.
 */
export async function getFixtures(event?: number): Promise<Fixture[]> {
  if (event) {
    return fetchFPL<Fixture[]>(`/fixtures/?event=${event}`);
  }

  const all = await fetchFPL<Fixture[]>('/fixtures/');
  if (await fixturesMatchCurrentSeason(all)) return all;

  // Stale cache — rebuild from the per-event endpoint, which stays correct.
  return getFixturesByEvent();
}

/** Season-start boundary: the GW1 deadline for the live season. */
async function getSeasonStart(): Promise<Date | null> {
  try {
    const bootstrap = await getBootstrap();
    const gw1 = bootstrap.events.find(e => e.id === 1);
    return gw1 ? new Date(gw1.deadline_time) : null;
  } catch {
    return null;
  }
}

/**
 * A fixture list belongs to the current season if any kickoff lands on or
 * after the season's GW1 deadline. A previous-season payload is entirely
 * before that boundary.
 */
async function fixturesMatchCurrentSeason(fixtures: Fixture[]): Promise<boolean> {
  if (fixtures.length === 0) return true;
  const seasonStart = await getSeasonStart();
  if (!seasonStart) return true; // Can't verify — don't block the request.

  // Allow a day of slack for kickoffs scheduled just before the deadline.
  const cutoff = seasonStart.getTime() - 24 * 60 * 60 * 1000;
  return fixtures.some(f => f.kickoff_time && new Date(f.kickoff_time).getTime() >= cutoff);
}

/** Rebuild the full fixture list from per-event requests. */
async function getFixturesByEvent(): Promise<Fixture[]> {
  const events = Array.from({ length: 38 }, (_, i) => i + 1);
  const batches = await Promise.all(
    events.map(ev =>
      fetchFPL<Fixture[]>(`/fixtures/?event=${ev}`).catch(() => [] as Fixture[])
    )
  );
  return batches.flat();
}

export async function getFutureFixtures() {
  return fetchFPL<Fixture[]>('/fixtures/?future=1');
}

export async function getPlayerSummary(elementId: number) {
  return fetchFPL<{
    fixtures: Array<{
      id: number;
      event: number;
      team_h: number;
      team_a: number;
      team_h_difficulty: number;
      team_a_difficulty: number;
      is_home: boolean;
      difficulty: number;
      kickoff_time: string;
    }>;
    history: Array<Record<string, unknown>>;
    history_past: Array<Record<string, unknown>>;
  }>(`/element-summary/${elementId}/`, 60_000);
}

export async function getManager(managerId: number) {
  return fetchFPL<import('@/types/fpl').FPLManager>(`/entry/${managerId}/`);
}

export async function getManagerHistory(managerId: number) {
  return fetchFPL<import('@/types/fpl').FPLManagerHistory>(`/entry/${managerId}/history/`);
}

export async function getManagerPicks(managerId: number, event: number) {
  return fetchFPL<import('@/types/fpl').FPLManagerPicks>(`/entry/${managerId}/event/${event}/picks/`, 60_000);
}

export async function getManagerTransfers(managerId: number) {
  return fetchFPL<import('@/types/fpl').FPLTransfer[]>(`/entry/${managerId}/transfers/`);
}

export async function getLivePoints(event: number) {
  return fetchFPL<{
    elements: Array<{
      id: number;
      stats: Record<string, number>;
      explain: Array<{
        fixture: number;
        stats: Array<{ identifier: string; points: number; value: number }>;
      }>;
    }>;
  }>(`/event/${event}/live/`, 30_000);
}

export async function getEventStatus() {
  return fetchFPL<{
    status: Array<{ date: string; event: number; points: string; bonus_added: boolean }>;
    leagues: string;
  }>('/event-status/', 60_000);
}
