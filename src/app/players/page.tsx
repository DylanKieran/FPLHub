'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import LoadingSpinner from '@/components/LoadingSpinner';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import FDRBadge from '@/components/FDRBadge';
import { Search, ChevronDown, Check, Download, GitCompare, Info, Star, X } from 'lucide-react';
import { useWatchlist } from '@/lib/useWatchlist';
import PlayerCompare from '@/components/PlayerCompare';
import { POSITION_MAP } from '@/types/fpl';
import {
  defconPointsPer90, defconHitRate, defconThreshold, isDefconEligible,
  defensiveActionsPer90, hasDefconData, isDefconDataAvailable,
  positionCounts, rankToTopPercent, formatTopPercent, percentileTier,
  getAvailability, availabilityColor, statHasSpread,
} from '@/lib/algorithms';
import type { FPLPlayer, FPLTeam, FPLFixture, FPLBootstrap } from '@/types/fpl';

type SortField =
  | 'total_points' | 'form' | 'now_cost' | 'points_per_game'
  | 'expected_goals' | 'expected_assists' | 'ict_index'
  | 'selected_by_percent' | 'bonus' | 'defensive_contribution';

type SortDir = 'asc' | 'desc';

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'total_points', label: 'Total points' },
  { value: 'form', label: 'Form' },
  { value: 'now_cost', label: 'Price' },
  { value: 'points_per_game', label: 'PPG' },
  { value: 'expected_goals', label: 'xG' },
  { value: 'expected_assists', label: 'xA' },
  { value: 'defensive_contribution', label: 'DefCon' },
  { value: 'ict_index', label: 'ICT Index' },
  { value: 'selected_by_percent', label: 'Selected %' },
  { value: 'bonus', label: 'Bonus' },
];

const POSITIONS = [
  { value: 0, label: 'All' },
  { value: 1, label: 'GKP' },
  { value: 2, label: 'DEF' },
  { value: 3, label: 'MID' },
  { value: 4, label: 'FWD' },
];

const PAGE_SIZE = 12;

// Module-level cache so re-expanding a player doesn't refetch its history.
const ownershipCache = new Map<number, HistoryPoint[] | 'error'>();

interface HistoryPoint { gw: number; pct: number }

interface FixtureInfo { event: number; opponent: string; isHome: boolean; difficulty: number }

/** Which rank-backed stats currently vary across the league. */
interface StatSpread {
  form: boolean; ppg: boolean; ict: boolean;
  threat: boolean; creativity: boolean; owned: boolean;
}

function getSortValue(player: FPLPlayer, field: SortField): number {
  switch (field) {
    case 'total_points': return player.total_points;
    case 'form': return parseFloat(player.form) || 0;
    case 'now_cost': return player.now_cost;
    case 'points_per_game': return parseFloat(player.points_per_game) || 0;
    case 'expected_goals': return parseFloat(player.expected_goals) || 0;
    case 'expected_assists': return parseFloat(player.expected_assists) || 0;
    case 'ict_index': return parseFloat(player.ict_index) || 0;
    case 'selected_by_percent': return parseFloat(player.selected_by_percent) || 0;
    case 'bonus': return player.bonus;
    case 'defensive_contribution': return defconPointsPer90(player);
  }
}

function getPositionChipClass(pos: string) {
  if (pos === 'GKP') return 'pos-chip-gkp';
  if (pos === 'DEF') return 'pos-chip-def';
  if (pos === 'MID') return 'pos-chip-mid';
  return 'pos-chip-fwd';
}

function getFDRStyle(difficulty: number): { bg: string; text: string } {
  const map: Record<number, { bg: string; text: string }> = {
    1: { bg: '#DAFBE1', text: '#1B873B' },
    2: { bg: '#C3F7CB', text: '#1B873B' },
    3: { bg: '#FFF4CC', text: '#BF8700' },
    4: { bg: '#FFCECB', text: '#CF222E' },
    5: { bg: '#F8B4B4', text: '#9E1B1B' },
  };
  return map[difficulty] || { bg: '#E0E3E8', text: '#5F6672' };
}

function getFormColor(form: number): string | undefined {
  if (form >= 5) return 'var(--semantic-green-600)';
  if (form < 3) return 'var(--semantic-red-600)';
  return undefined;
}

/** DefCon is worth +2 per match, so ~1.4/90 means it lands most weeks. */
function defconColor(player: FPLPlayer): string {
  if (!isDefconEligible(player.element_type) || !hasDefconData(player)) return 'var(--text-tertiary)';
  const rate = defconPointsPer90(player);
  if (rate >= 1.4) return 'var(--semantic-green-600)';
  if (rate >= 0.8) return 'var(--semantic-amber-600)';
  return 'var(--text-secondary)';
}

function defconCell(player: FPLPlayer): string {
  if (!isDefconEligible(player.element_type)) return '—';
  if (!hasDefconData(player)) return '—';
  return defconPointsPer90(player).toFixed(2);
}

function defconTooltip(player: FPLPlayer): string {
  if (!isDefconEligible(player.element_type)) {
    return 'Goalkeepers do not accrue defensive contribution points';
  }
  if (!hasDefconData(player)) {
    return 'Defensive contribution data is not published until the season starts';
  }
  const threshold = defconThreshold(player.element_type);
  const stat = player.element_type === 2 ? 'CBIT' : 'CBIRT';
  const hit = Math.round(defconHitRate(player) * 100);
  return `+2 per match on ${threshold}+ ${stat} · threshold cleared in ${hit}% of starts`;
}

function orderLabel(order: number | null): string {
  if (!order) return '—';
  if (order === 1) return '1st choice';
  if (order === 2) return '2nd choice';
  if (order === 3) return '3rd choice';
  return `${order}th choice`;
}

export default function PlayersPage() {
  const [bootstrap, setBootstrap] = useState<FPLBootstrap | null>(null);
  const [fixtures, setFixtures] = useState<FPLFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [posFilter, setPosFilter] = useState(0);
  const [teamFilter, setTeamFilter] = useState(0);
  const [sortField, setSortField] = useState<SortField>('total_points');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [search, setSearch] = useState('');
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(20);
  const [priceInitialized, setPriceInitialized] = useState(false);
  const [availableOnly, setAvailableOnly] = useState(true);

  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const watchlist = useWatchlist();

  // Players selected for side-by-side comparison (transient, not persisted).
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [showCompare, setShowCompare] = useState(false);

  function toggleCompare(playerId: number) {
    setCompareIds(prev =>
      prev.includes(playerId)
        ? prev.filter(id => id !== playerId)
        // Four columns is the most that stays readable.
        : prev.length >= 4 ? prev : [...prev, playerId]
    );
  }

  useEffect(() => {
    async function fetchData() {
      try {
        const [bsRes, fxRes] = await Promise.all([
          fetch('/api/fpl/bootstrap'),
          fetch('/api/fpl/fixtures'),
        ]);
        if (!bsRes.ok || !fxRes.ok) throw new Error('Failed to fetch FPL data');
        setBootstrap(await bsRes.json());
        setFixtures(await fxRes.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const teamMap = useMemo(() => {
    if (!bootstrap) return new Map<number, FPLTeam>();
    return new Map(bootstrap.teams.map(t => [t.id, t]));
  }, [bootstrap]);

  const nextEvent = useMemo(() => {
    if (!bootstrap) return null;
    return bootstrap.events.find(e => e.is_next) ?? null;
  }, [bootstrap]);

  const priceBounds = useMemo(() => {
    if (!bootstrap || bootstrap.elements.length === 0) return { min: 0, max: 20 };
    const costs = bootstrap.elements.map(p => p.now_cost);
    return { min: Math.floor(Math.min(...costs)) / 10, max: Math.ceil(Math.max(...costs)) / 10 };
  }, [bootstrap]);

  useEffect(() => {
    if (!priceInitialized && bootstrap) {
      setMinPrice(priceBounds.min);
      setMaxPrice(priceBounds.max);
      setPriceInitialized(true);
    }
  }, [bootstrap, priceBounds, priceInitialized]);

  const getPlayerNextFixtures = useCallback(
    (player: FPLPlayer): FixtureInfo[] => {
      if (!nextEvent) return [];
      const targetGWs = [nextEvent.id, nextEvent.id + 1, nextEvent.id + 2, nextEvent.id + 3, nextEvent.id + 4];
      return fixtures
        .filter(f => f.event !== null && targetGWs.includes(f.event!) && (f.team_h === player.team || f.team_a === player.team))
        .map(f => {
          const isHome = f.team_h === player.team;
          const opponentId = isHome ? f.team_a : f.team_h;
          const difficulty = isHome ? f.team_h_difficulty : f.team_a_difficulty;
          return { event: f.event!, opponent: teamMap.get(opponentId)?.short_name ?? '???', isHome, difficulty };
        })
        .slice(0, 5);
    },
    [fixtures, nextEvent, teamMap]
  );

  const filteredPlayers = useMemo(() => {
    if (!bootstrap) return [];
    let players = [...bootstrap.elements];
    if (posFilter > 0) players = players.filter(p => p.element_type === posFilter);
    if (teamFilter > 0) players = players.filter(p => p.team === teamFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      players = players.filter(p => p.web_name.toLowerCase().includes(q));
    }
    players = players.filter(p => p.now_cost / 10 >= minPrice - 0.001 && p.now_cost / 10 <= maxPrice + 0.001);
    // Always hide players who have left the league — they're never actionable.
    players = players.filter(p => !getAvailability(p).withdrawn);
    if (availableOnly) players = players.filter(p => getAvailability(p).level === 'available');
    if (watchlistOnly) players = players.filter(p => watchlist.ids.includes(p.id));
    players.sort((a, b) => {
      const va = getSortValue(a, sortField);
      const vb = getSortValue(b, sortField);
      return sortDir === 'desc' ? vb - va : va - vb;
    });
    return players;
  }, [bootstrap, posFilter, teamFilter, search, minPrice, maxPrice, availableOnly, watchlistOnly, watchlist.ids, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredPlayers.length / PAGE_SIZE));
  const pageSlice = filteredPlayers.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => { setPage(0); }, [posFilter, teamFilter, search, minPrice, maxPrice, availableOnly, watchlistOnly, sortField, sortDir]);

  function handleColumnSort(field: SortField) {
    if (sortField === field) setSortDir(d => (d === 'desc' ? 'asc' : 'desc'));
    else { setSortField(field); setSortDir('desc'); }
  }

  function handleExportCSV() {
    if (!bootstrap) return;
    const headers = ['Name', 'Team', 'Position', 'Price', 'Form', 'PPG', 'Points', 'xG', 'xA', 'ICT', 'Selected %'];
    const rows = filteredPlayers.map(p => [
      p.web_name,
      teamMap.get(p.team)?.short_name ?? '',
      POSITION_MAP[p.element_type],
      (p.now_cost / 10).toFixed(1),
      p.form,
      p.points_per_game,
      p.total_points,
      p.expected_goals,
      p.expected_assists,
      p.ict_index,
      p.selected_by_percent,
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fpl-players.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <LoadingSpinner message="Loading player data..." />;
  if (error) return <EmptyState variant="error" title="Error loading data" description={error} />;

  const totalPlayerCount = bootstrap?.elements.length ?? 0;
  // FPL zeroes defensive stats until the season is underway.
  const defconReady = bootstrap ? isDefconDataAvailable(bootstrap.elements) : true;
  // Denominators for the API's within-position rank fields.
  const posCounts = bootstrap ? positionCounts(bootstrap.elements) : {};
  // Which stats currently vary across the league — pre-season several are
  // uniformly zero, making their ranks meaningless.
  const statSpread = {
    form: bootstrap ? statHasSpread(bootstrap.elements, p => parseFloat(p.form) || 0) : true,
    ppg: bootstrap ? statHasSpread(bootstrap.elements, p => parseFloat(p.points_per_game) || 0) : true,
    ict: bootstrap ? statHasSpread(bootstrap.elements, p => parseFloat(p.ict_index) || 0) : true,
    threat: bootstrap ? statHasSpread(bootstrap.elements, p => parseFloat(p.threat) || 0) : true,
    creativity: bootstrap ? statHasSpread(bootstrap.elements, p => parseFloat(p.creativity) || 0) : true,
    owned: bootstrap ? statHasSpread(bootstrap.elements, p => parseFloat(p.selected_by_percent) || 0) : true,
  };

  // Resolve the selected ids against the full dataset — a compared player may
  // have been filtered out of the current page.
  const comparePlayers = (bootstrap?.elements ?? [])
    .filter(p => compareIds.includes(p.id))
    .map(p => ({
      player: p,
      team: teamMap.get(p.team),
      fixtures: getPlayerNextFixtures(p),
    }));

  return (
    <div className="space-y-6">
      {showCompare && comparePlayers.length >= 2 && (
        <PlayerCompare
          players={comparePlayers}
          onClose={() => setShowCompare(false)}
          onRemove={id => {
            const next = compareIds.filter(cid => cid !== id);
            setCompareIds(next);
            if (next.length < 2) setShowCompare(false);
          }}
        />
      )}

      <PageHeader
        title="Player Explorer"
        subtitle={`${totalPlayerCount.toLocaleString()} players · ${pageSlice.length} shown`}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCompare(true)}
              disabled={compareIds.length < 2}
              className="btn-secondary disabled:opacity-50"
              title={compareIds.length < 2 ? 'Select at least two players to compare' : 'Compare selected players'}
            >
              <GitCompare size={14} className="mr-1.5" />
              Compare{compareIds.length > 0 ? ` (${compareIds.length})` : ''}
            </button>
            {compareIds.length > 0 && (
              <button
                type="button"
                onClick={() => { setCompareIds([]); setShowCompare(false); }}
                className="w-9 h-9 rounded-md-design flex items-center justify-center transition-colors"
                style={{ background: 'var(--surface-sunken)', color: 'var(--text-secondary)' }}
                title="Clear comparison selection"
                aria-label="Clear comparison selection"
              >
                <X size={14} />
              </button>
            )}
            <button type="button" onClick={handleExportCSV} className="btn-primary">
              <Download size={14} className="mr-1.5" /> Export CSV
            </button>
          </div>
        }
      />

      {/* Filter Card */}
      <div className="card space-y-4">
        {/* Row 1: Position + Search */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="micro-label mr-1">Position</span>
            <div className="segmented-control">
              {POSITIONS.map(pos => (
                <button
                  key={pos.value}
                  onClick={() => setPosFilter(pos.value)}
                  className={posFilter === pos.value ? 'active' : ''}
                >
                  {pos.label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
            <input
              type="text"
              placeholder="Search by name"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field pl-8 w-56"
            />
          </div>
        </div>

        {/* Row 2: Team / Sort / Price / Available only */}
        <div className="flex flex-wrap items-center gap-3">
          <Dropdown
            value={teamFilter}
            options={[{ value: 0, label: 'All teams' }, ...(bootstrap?.teams.slice().sort((a, b) => a.name.localeCompare(b.name)).map(t => ({ value: t.id, label: t.name })) ?? [])]}
            onChange={setTeamFilter}
          />

          <Dropdown
            prefix="Sort"
            value={sortField}
            options={SORT_OPTIONS}
            onChange={setSortField}
          />

          <PriceRangeControl min={minPrice} max={maxPrice} bounds={priceBounds} onChange={(mn, mx) => { setMinPrice(mn); setMaxPrice(mx); }} />

          <button
            type="button"
            onClick={() => setAvailableOnly(a => !a)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs-design font-medium transition-colors"
            style={{
              background: availableOnly ? 'var(--semantic-green-50)' : 'var(--surface-sunken)',
              color: availableOnly ? 'var(--semantic-green-600)' : 'var(--text-secondary)',
              border: `1px solid ${availableOnly ? 'var(--semantic-green-100)' : 'var(--border-subtle)'}`,
            }}
          >
            Available only {availableOnly && <Check size={12} />}
          </button>

          <button
            type="button"
            onClick={() => setWatchlistOnly(w => !w)}
            disabled={watchlist.count === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs-design font-medium transition-colors disabled:opacity-50"
            style={{
              background: watchlistOnly ? 'var(--semantic-amber-50)' : 'var(--surface-sunken)',
              color: watchlistOnly ? 'var(--semantic-amber-600)' : 'var(--text-secondary)',
              border: `1px solid ${watchlistOnly ? 'var(--semantic-amber-100)' : 'var(--border-subtle)'}`,
            }}
            title={watchlist.count === 0 ? 'Star players to build a watchlist' : 'Show only watchlisted players'}
          >
            <Star size={12} fill={watchlistOnly ? 'var(--semantic-amber-500)' : 'none'} />
            Watchlist{watchlist.count > 0 ? ` (${watchlist.count})` : ''}
          </button>
        </div>
      </div>

      {/* DefCon availability notice — pre-season the API reports zeros */}
      {!defconReady && (
        <div className="rounded-md-design p-3 flex items-start gap-2.5" style={{ background: 'var(--semantic-blue-50)', border: '1px solid var(--semantic-blue-100)' }}>
          <Info size={15} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--semantic-blue-600)' }} />
          <p className="text-xs-design" style={{ color: 'var(--text-secondary)' }}>
            <span className="font-medium" style={{ color: 'var(--semantic-blue-600)' }}>DefCon data not yet published.</span>{' '}
            FPL resets defensive contribution stats over the summer, so the DEFCON column stays empty until the season begins.
          </p>
        </div>
      )}

      {/* Table */}
      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm-design">
            <thead>
              <tr style={{ background: 'var(--surface-sunken)' }}>
                <th className="pl-4 py-2.5 w-8" title="Watchlist" />
                <th className="py-2.5 w-8" title="Select to compare (up to 4 players)" />
                <th
                  className="py-2.5 text-left micro-label w-14"
                  title="Position: goalkeeper, defender, midfielder or forward"
                  style={{ textDecoration: 'underline dotted', textUnderlineOffset: '3px', textDecorationColor: 'var(--border-default)' }}
                >
                  POS
                </th>
                <th
                  className="py-2.5 text-left micro-label"
                  title="Player name and club"
                  style={{ textDecoration: 'underline dotted', textUnderlineOffset: '3px', textDecorationColor: 'var(--border-default)' }}
                >
                  PLAYER
                </th>
                <ThSortable field="total_points" label="PTS" onSort={handleColumnSort} sortField={sortField} sortDir={sortDir} title="Total points scored so far this season" />
                <ThSortable field="now_cost" label="£" onSort={handleColumnSort} sortField={sortField} sortDir={sortDir} title="Current selling price, in £m" />
                <ThSortable field="form" label="FORM" onSort={handleColumnSort} sortField={sortField} sortDir={sortDir} title="Average points per match over the last 30 days" />
                <ThSortable field="points_per_game" label="PPG" onSort={handleColumnSort} sortField={sortField} sortDir={sortDir} title="Average points per match played this season" />
                <ThSortable field="expected_goals" label="XG" onSort={handleColumnSort} sortField={sortField} sortDir={sortDir} title="Expected goals — quality of scoring chances based on shot location and type" />
                <ThSortable field="expected_assists" label="XA" onSort={handleColumnSort} sortField={sortField} sortDir={sortDir} title="Expected assists — quality of chances created for teammates" />
                <ThSortable field="defensive_contribution" label="DEFCON" onSort={handleColumnSort} sortField={sortField} sortDir={sortDir} title="Defensive contribution points per 90 — DEF earn +2 for 10+ CBIT, MID/FWD earn +2 for 12+ CBIRT actions in a match" />
                <ThSortable field="ict_index" label="ICT" onSort={handleColumnSort} sortField={sortField} sortDir={sortDir} title="Influence, Creativity and Threat index — FPL's combined underlying-performance score" />
                <ThSortable field="selected_by_percent" label="OWN" onSort={handleColumnSort} sortField={sortField} sortDir={sortDir} title="Percentage of managers who currently own this player" />
                <th
                  className="py-2.5 pr-4 text-right micro-label"
                  title="Fixture difficulty for the next five gameweeks (1 = easiest, 5 = hardest)"
                  style={{ textDecoration: 'underline dotted', textUnderlineOffset: '3px', textDecorationColor: 'var(--border-default)' }}
                >
                  NEXT 5
                </th>
              </tr>
            </thead>
            <tbody>
              {pageSlice.map(player => {
                const team = teamMap.get(player.team);
                const isExpanded = expandedId === player.id;
                const nextFixtures = getPlayerNextFixtures(player);

                return (
                  <PlayerRow
                    key={player.id}
                    player={player}
                    team={team}
                    isExpanded={isExpanded}
                    nextFixtures={nextFixtures}
                    totalPlayers={totalPlayerCount}
                    posCount={posCounts[player.element_type] ?? 0}
                    statSpread={statSpread}
                    watched={watchlist.has(player.id)}
                    onToggleWatch={() => watchlist.toggle(player.id)}
                    selected={compareIds.includes(player.id)}
                    selectDisabled={compareIds.length >= 4 && !compareIds.includes(player.id)}
                    onToggleSelect={() => toggleCompare(player.id)}
                    onToggle={() => setExpandedId(isExpanded ? null : player.id)}
                  />
                );
              })}
              {pageSlice.length === 0 && (
                <tr>
                  <td colSpan={14} className="px-4 py-12 text-center" style={{ color: 'var(--text-tertiary)' }}>
                    No players match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs-design" style={{ color: 'var(--text-tertiary)' }}>
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredPlayers.length)} of {filteredPlayers.length}
          </p>
          <div className="flex items-center gap-2">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="btn-secondary disabled:opacity-30">Prev</button>
            <span className="text-sm-design mono" style={{ color: 'var(--text-secondary)' }}>{page + 1} / {totalPages}</span>
            <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="btn-secondary disabled:opacity-30">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ────────────────── Sub-components ────────────────── */

function Dropdown<T extends string | number>({ label, value, options, onChange, prefix }: {
  label?: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; prefix?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selected = options.find(o => o.value === value);

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)} className="input-field flex items-center gap-1.5 whitespace-nowrap">
        <span>{prefix ? `${prefix}: ` : ''}{selected?.label ?? label ?? ''}</span>
        <ChevronDown size={13} style={{ color: 'var(--text-tertiary)' }} />
      </button>
      {open && (
        <div
          className="absolute top-full left-0 mt-1 rounded-md-design border shadow-level-3 z-30 py-1 max-h-64 overflow-y-auto"
          style={{ background: 'var(--surface-raised)', borderColor: 'var(--border-subtle)', minWidth: '170px' }}
        >
          {options.map(o => (
            <button
              key={String(o.value)}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-sm-design transition-colors"
              style={{
                color: o.value === value ? 'var(--semantic-blue-600)' : 'var(--text-primary)',
                background: o.value === value ? 'var(--semantic-blue-50)' : undefined,
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PriceRangeControl({ min, max, bounds, onChange }: {
  min: number; max: number; bounds: { min: number; max: number }; onChange: (min: number, max: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const span = Math.max(bounds.max - bounds.min, 0.1);
  const leftPct = ((min - bounds.min) / span) * 100;
  const rightPct = ((max - bounds.min) / span) * 100;

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)} className="input-field flex items-center gap-3">
        <span className="whitespace-nowrap">Price £{min.toFixed(1)} – £{max.toFixed(1)}m</span>
        <div className="relative w-24 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--surface-sunken)' }}>
          <div className="absolute h-full rounded-full" style={{ left: `${leftPct}%`, right: `${100 - rightPct}%`, background: 'var(--semantic-blue-500)' }} />
        </div>
      </button>
      {open && (
        <div
          className="absolute top-full left-0 mt-1 rounded-md-design border shadow-level-3 z-30 p-4"
          style={{ background: 'var(--surface-raised)', borderColor: 'var(--border-subtle)', width: '220px' }}
        >
          <div className="mb-4">
            <div className="flex justify-between text-xs-design mb-1" style={{ color: 'var(--text-secondary)' }}>
              <span>Min</span><span className="mono">£{min.toFixed(1)}m</span>
            </div>
            <input
              type="range" min={bounds.min} max={bounds.max} step={0.1} value={min}
              onChange={e => onChange(Math.min(Number(e.target.value), max), max)}
              className="w-full" style={{ accentColor: 'var(--semantic-blue-500)' }}
            />
          </div>
          <div>
            <div className="flex justify-between text-xs-design mb-1" style={{ color: 'var(--text-secondary)' }}>
              <span>Max</span><span className="mono">£{max.toFixed(1)}m</span>
            </div>
            <input
              type="range" min={bounds.min} max={bounds.max} step={0.1} value={max}
              onChange={e => onChange(min, Math.max(Number(e.target.value), min))}
              className="w-full" style={{ accentColor: 'var(--semantic-blue-500)' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ThSortable({ field, label, onSort, sortField, sortDir, title }: {
  field: SortField; label: string; onSort: (f: SortField) => void; sortField: SortField; sortDir: SortDir; title?: string;
}) {
  const active = sortField === field;
  return (
    <th
      className="py-2.5 text-left micro-label cursor-pointer select-none whitespace-nowrap transition-colors"
      onClick={() => onSort(field)}
      title={title}
      style={{
        color: active ? 'var(--semantic-blue-600)' : undefined,
        textDecoration: title ? 'underline dotted' : undefined,
        textUnderlineOffset: title ? '3px' : undefined,
        textDecorationColor: title ? 'var(--border-default)' : undefined,
      }}
    >
      {label}
      {active ? (
        <span className="ml-0.5" style={{ color: 'var(--semantic-blue-600)' }}>{sortDir === 'desc' ? '▼' : '▲'}</span>
      ) : (
        <span className="ml-0.5" style={{ color: 'var(--text-tertiary)' }}>↕</span>
      )}
    </th>
  );
}

function PlayerRow({
  player, team, isExpanded, nextFixtures, totalPlayers, posCount, statSpread,
  watched, onToggleWatch, selected, selectDisabled, onToggleSelect, onToggle,
}: {
  player: FPLPlayer; team: FPLTeam | undefined; isExpanded: boolean;
  nextFixtures: FixtureInfo[];
  totalPlayers: number;
  posCount: number;
  statSpread: StatSpread;
  watched: boolean;
  onToggleWatch: () => void;
  selected: boolean;
  selectDisabled: boolean;
  onToggleSelect: () => void;
  onToggle: () => void;
}) {
  const posLabel = POSITION_MAP[player.element_type];
  const formValue = parseFloat(player.form) || 0;
  const availability = getAvailability(player);

  return (
    <>
      <tr
        className="cursor-pointer transition-colors duration-200"
        style={{
          borderBottom: '1px solid var(--row-divider)',
          background: isExpanded ? 'var(--semantic-blue-50)' : selected ? 'var(--surface-sunken)' : undefined,
        }}
        onClick={onToggle}
      >
        {/* Watchlist star — stopPropagation so it doesn't expand the row */}
        <td className="pl-4 py-3" onClick={e => e.stopPropagation()}>
          <button
            type="button"
            onClick={onToggleWatch}
            className="flex items-center justify-center transition-colors"
            aria-label={watched ? `Remove ${player.web_name} from watchlist` : `Add ${player.web_name} to watchlist`}
            title={watched ? 'Remove from watchlist' : 'Add to watchlist'}
          >
            <Star
              size={14}
              style={{ color: watched ? 'var(--semantic-amber-500)' : 'var(--border-default)' }}
              fill={watched ? 'var(--semantic-amber-500)' : 'none'}
            />
          </button>
        </td>

        {/* Compare selection */}
        <td className="py-3" onClick={e => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selected}
            disabled={selectDisabled}
            onChange={onToggleSelect}
            style={{ accentColor: 'var(--semantic-blue-500)' }}
            aria-label={`Select ${player.web_name} to compare`}
            title={selectDisabled ? 'Maximum of four players' : 'Select to compare'}
          />
        </td>

        <td className="py-3">
          <span className={`${getPositionChipClass(posLabel)} text-[10px] font-medium px-1.5 py-0.5 rounded-sm-design`}>
            {posLabel}
          </span>
        </td>
        <td className="py-3">
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: availabilityColor(availability.level) }}
              title={availability.note ? `${availability.label} — ${availability.note}` : availability.label}
            />
            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{player.web_name}</span>
            <span className="text-xs-design" style={{ color: 'var(--text-tertiary)' }}>{team?.short_name}</span>
            {availability.level !== 'available' && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-sm-design font-medium whitespace-nowrap"
                style={{
                  background: 'var(--surface-sunken)',
                  color: availabilityColor(availability.level),
                }}
              >
                {availability.label}
              </span>
            )}
          </div>
        </td>
        <td className="py-3 mono font-semibold" style={{ color: 'var(--text-primary)' }}>{player.total_points}</td>
        <td className="py-3 mono whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{'£'}{(player.now_cost / 10).toFixed(1)}</td>
        <td className="py-3 mono font-medium" style={{ color: getFormColor(formValue) ?? 'var(--text-primary)' }}>{player.form}</td>
        <td className="py-3 mono" style={{ color: 'var(--text-secondary)' }}>{player.points_per_game}</td>
        <td className="py-3 mono" style={{ color: 'var(--text-secondary)' }}>{parseFloat(player.expected_goals).toFixed(2)}</td>
        <td className="py-3 mono" style={{ color: 'var(--text-secondary)' }}>{parseFloat(player.expected_assists).toFixed(2)}</td>
        <td className="py-3 mono font-medium" style={{ color: defconColor(player) }} title={defconTooltip(player)}>
          {defconCell(player)}
        </td>
        <td className="py-3 mono" style={{ color: 'var(--text-secondary)' }}>{parseFloat(player.ict_index).toFixed(1)}</td>
        <td className="py-3 mono" style={{ color: 'var(--text-secondary)' }}>{player.selected_by_percent}%</td>
        <td className="py-3 pr-4">
          <div className="flex gap-1 justify-end">
            {nextFixtures.map((f, i) => <FDRBadge key={i} difficulty={f.difficulty} compact />)}
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr style={{ borderBottom: '1px solid var(--row-divider)' }}>
          <td colSpan={14} className="px-6 py-5" style={{ background: 'var(--surface-sunken)' }}>
            <ExpandedPlayerDetail player={player} nextFixtures={nextFixtures} totalPlayers={totalPlayers} posCount={posCount} statSpread={statSpread} />
          </td>
        </tr>
      )}
    </>
  );
}

function ExpandedPlayerDetail({ player, nextFixtures, totalPlayers, posCount, statSpread }: {
  player: FPLPlayer; nextFixtures: FixtureInfo[]; totalPlayers: number; posCount: number; statSpread: StatSpread;
}) {
  const xg = parseFloat(player.expected_goals) || 0;
  const goalsDelta = player.goals_scored - xg;
  const influence = parseFloat(player.influence) || 0;
  const creativity = parseFloat(player.creativity) || 0;
  const threat = parseFloat(player.threat) || 0;
  const maxICT = Math.max(influence, creativity, threat, 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* ICT Breakdown */}
      <div>
        <h4 className="micro-label mb-3">ICT Breakdown</h4>
        <div className="space-y-2.5">
          <ICTBar label="Influence" value={influence} max={maxICT} color="#4C72B0" />
          <ICTBar label="Creativity" value={creativity} max={maxICT} color="#DD8452" />
          <ICTBar label="Threat" value={threat} max={maxICT} color="#8172B3" />
        </div>
        <div className="grid grid-cols-4 gap-3 mt-5">
          <MiniStat label="Goals" value={player.goals_scored} />
          <MiniStat label="Assists" value={player.assists} />
          <MiniStat label="Bonus" value={player.bonus} />
          <MiniStat label="Starts" value={player.starts} />
        </div>

        {/* Defensive Contributions */}
        {isDefconEligible(player.element_type) && (
          <div className="mt-5">
            <h4 className="micro-label mb-2">
              Defensive Contributions · {defconThreshold(player.element_type)}+ {player.element_type === 2 ? 'CBIT' : 'CBIRT'}
            </h4>
            {hasDefconData(player) ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-raised)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${defconHitRate(player) * 100}%`, background: defconColor(player) }}
                    />
                  </div>
                  <span className="mono text-xs-design" style={{ color: 'var(--text-secondary)' }}>
                    {Math.round(defconHitRate(player) * 100)}% of starts
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <MiniStat label="Pts /90" value={defconPointsPer90(player).toFixed(2)} />
                  <MiniStat label="Season pts" value={player.defensive_contribution ?? 0} />
                  <MiniStat label="Actions /90" value={defensiveActionsPer90(player).toFixed(1)} />
                </div>
              </>
            ) : (
              <p className="text-xs-design" style={{ color: 'var(--text-tertiary)' }}>
                Not published until the season starts.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Ownership Trend */}
      <div>
        <h4 className="micro-label mb-3">Ownership Trend · 12 GW</h4>
        <OwnershipTrendChart playerId={player.id} totalPlayers={totalPlayers} />
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="rounded-md-design p-2.5 text-center" style={{ background: 'var(--semantic-green-50)' }}>
            <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>Transfers in</p>
            <p className="mono text-sm-design font-semibold" style={{ color: 'var(--semantic-green-600)' }}>
              +{player.transfers_in_event.toLocaleString()}
            </p>
          </div>
          <div className="rounded-md-design p-2.5 text-center" style={{ background: 'var(--semantic-red-50)' }}>
            <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>Transfers out</p>
            <p className="mono text-sm-design font-semibold" style={{ color: 'var(--semantic-red-600)' }}>
              -{player.transfers_out_event.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Next 5 Fixtures */}
      <div>
        <h4 className="micro-label mb-3">Next 5 Fixtures</h4>
        <div className="grid grid-cols-5 gap-1.5">
          {nextFixtures.length > 0 ? nextFixtures.map((f, i) => {
            const s = getFDRStyle(f.difficulty);
            return (
              <div key={i} className="rounded-md-design text-center py-2" style={{ background: s.bg }}>
                <p className="text-[9px] font-medium" style={{ color: s.text, opacity: 0.75 }}>GW{f.event}</p>
                <p className="text-xs-design font-bold mt-0.5" style={{ color: s.text }}>{f.opponent}</p>
                <p className="text-[9px] mt-0.5" style={{ color: s.text, opacity: 0.75 }}>{f.isHome ? 'H' : 'A'}·{f.difficulty}</p>
              </div>
            );
          }) : (
            <p className="col-span-5 text-xs-design" style={{ color: 'var(--text-tertiary)' }}>No upcoming fixtures.</p>
          )}
        </div>
        {/* Percentile context — ranks come pre-computed from the API */}
        <h4 className="micro-label mt-5 mb-2">Rank vs {POSITION_MAP[player.element_type]}s</h4>
        <div className="flex flex-wrap gap-1.5">
          <PercentileBadge label="Form" rank={player.form_rank_type} total={posCount} available={statSpread.form} />
          <PercentileBadge label="PPG" rank={player.points_per_game_rank_type} total={posCount} available={statSpread.ppg} />
          <PercentileBadge label="ICT" rank={player.ict_index_rank_type} total={posCount} available={statSpread.ict} />
          <PercentileBadge label="Threat" rank={player.threat_rank_type} total={posCount} available={statSpread.threat} />
          <PercentileBadge label="Creativity" rank={player.creativity_rank_type} total={posCount} available={statSpread.creativity} />
          <PercentileBadge label="Owned" rank={player.selected_rank_type} total={posCount} available={statSpread.owned} />
        </div>

        {/* Per-90 rates — comparable across players regardless of minutes */}
        <h4 className="micro-label mt-5 mb-2">Per 90 Minutes</h4>
        <div className="space-y-1.5 text-sm-design">
          <StatLine label="xG / 90" value={(player.expected_goals_per_90 ?? 0).toFixed(2)} />
          <StatLine label="xA / 90" value={(player.expected_assists_per_90 ?? 0).toFixed(2)} />
          <StatLine label="xGI / 90" value={(player.expected_goal_involvements_per_90 ?? 0).toFixed(2)} />
          {player.element_type === 1 ? (
            <StatLine label="Saves / 90" value={(player.saves_per_90 ?? 0).toFixed(2)} />
          ) : (
            <StatLine label="xGC / 90" value={(player.expected_goals_conceded_per_90 ?? 0).toFixed(2)} />
          )}
        </div>

        <div className="space-y-1.5 mt-4 text-sm-design">
          <StatLine label="Penalties" value={orderLabel(player.penalties_order)} />
          <StatLine label="Corners / IFK" value={orderLabel(player.corners_and_indirect_freekicks_order)} />
          <StatLine
            label="xG over/under"
            value={`${goalsDelta >= 0 ? '+' : ''}${goalsDelta.toFixed(2)}`}
            valueColor={goalsDelta >= 0 ? 'var(--semantic-green-600)' : 'var(--semantic-red-600)'}
          />
          <StatLine
            label="FPL xPts (next GW)"
            value={player.ep_next ? parseFloat(player.ep_next).toFixed(1) : '—'}
          />
        </div>
        {player.news && (() => {
          const availability = getAvailability(player);
          const isSevere = availability.level === 'out' || availability.level === 'suspended' || availability.level === 'unavailable';
          return (
            <div
              className="mt-4 p-3 rounded-md-design"
              style={{
                background: isSevere ? 'var(--semantic-red-50)' : 'var(--semantic-amber-50)',
                border: `1px solid ${isSevere ? 'var(--semantic-red-100)' : 'var(--semantic-amber-100)'}`,
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs-design font-medium" style={{ color: isSevere ? 'var(--semantic-red-600)' : 'var(--semantic-amber-600)' }}>
                  {availability.label}
                </p>
                {player.news_added && (
                  <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                    {new Date(player.news_added).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                )}
              </div>
              <p className="text-xs-design" style={{ color: 'var(--text-secondary)' }}>{player.news}</p>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

function OwnershipTrendChart({ playerId, totalPlayers }: { playerId: number; totalPlayers: number }) {
  const [points, setPoints] = useState<HistoryPoint[] | 'loading' | 'error'>(ownershipCache.get(playerId) ?? 'loading');

  useEffect(() => {
    const cached = ownershipCache.get(playerId);
    if (cached) { setPoints(cached); return; }
    let cancelled = false;
    setPoints('loading');
    fetch(`/api/fpl/player/${playerId}`)
      .then(res => { if (!res.ok) throw new Error('Failed'); return res.json(); })
      .then((data: { history?: Array<Record<string, unknown>> }) => {
        const hist = data.history ?? [];
        const pts: HistoryPoint[] = hist.slice(-12).map(h => ({
          gw: Number(h.round),
          pct: totalPlayers > 0 ? (Number(h.selected) / totalPlayers) * 100 : 0,
        }));
        if (!cancelled) { ownershipCache.set(playerId, pts); setPoints(pts); }
      })
      .catch(() => { if (!cancelled) { ownershipCache.set(playerId, 'error'); setPoints('error'); } });
    return () => { cancelled = true; };
  }, [playerId, totalPlayers]);

  if (points === 'loading') {
    return <div className="h-20 flex items-center justify-center text-xs-design" style={{ color: 'var(--text-tertiary)' }}>Loading trend…</div>;
  }
  if (points === 'error' || points.length === 0) {
    return <div className="h-20 flex items-center justify-center text-xs-design" style={{ color: 'var(--text-tertiary)' }}>No trend data available.</div>;
  }

  const first = points[0];
  const last = points[points.length - 1];

  return (
    <div>
      <ResponsiveContainer width="100%" height={80}>
        <LineChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
          <Line type="monotone" dataKey="pct" stroke="var(--semantic-blue-500)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex justify-between text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
        <span>GW{first.gw} · {first.pct.toFixed(1)}%</span>
        <span>GW{last.gw} · {last.pct.toFixed(1)}%</span>
      </div>
    </div>
  );
}

const PERCENTILE_TIER_STYLES: Record<string, { bg: string; text: string }> = {
  elite: { bg: 'var(--semantic-green-100)', text: 'var(--semantic-green-600)' },
  strong: { bg: 'var(--semantic-blue-100)', text: 'var(--semantic-blue-600)' },
  average: { bg: 'var(--surface-raised)', text: 'var(--text-secondary)' },
  weak: { bg: 'var(--surface-raised)', text: 'var(--text-tertiary)' },
  none: { bg: 'var(--surface-raised)', text: 'var(--text-tertiary)' },
};

/** Shows where a player sits within their position for a given stat. */
function PercentileBadge({ label, rank, total, available = true }: {
  label: string; rank: number | null; total: number; available?: boolean;
}) {
  // A stat with no spread across the league (e.g. form pre-season) produces
  // arbitrary ranks — better to show nothing than a confident-looking number.
  if (!available) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-1 rounded-sm-design text-[10px] font-medium"
        style={{ background: 'var(--surface-raised)', color: 'var(--text-tertiary)' }}
        title={`${label}: not enough data yet`}
      >
        <span style={{ opacity: 0.75 }}>{label}</span>
        <span className="mono">—</span>
      </span>
    );
  }

  const topPercent = rankToTopPercent(rank, total);
  const tier = percentileTier(topPercent);
  const style = PERCENTILE_TIER_STYLES[tier];

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-1 rounded-sm-design text-[10px] font-medium"
      style={{ background: style.bg, color: style.text }}
      title={rank && total ? `${label}: rank ${rank} of ${total}` : `${label}: unranked`}
    >
      <span style={{ opacity: 0.75 }}>{label}</span>
      <span className="mono font-semibold">{formatTopPercent(topPercent, rank, total)}</span>
    </span>
  );
}

function StatLine({ label, value, valueColor }: { label: string; value: string | number; valueColor?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="mono font-medium" style={{ color: valueColor || 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <p className="mono text-lg-design font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
      <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
    </div>
  );
}

function ICTBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs-design mb-1">
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span className="mono" style={{ color: 'var(--text-primary)' }}>{value.toFixed(1)}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-raised)' }}>
        <div className="h-full rounded-full" style={{ width: `${(value / max) * 100}%`, background: color }} />
      </div>
    </div>
  );
}
