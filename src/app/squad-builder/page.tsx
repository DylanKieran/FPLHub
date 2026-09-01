'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import FDRBadge from '@/components/FDRBadge';
import { Search, Lock, X, Check } from 'lucide-react';
import { POSITION_MAP } from '@/types/fpl';
import { buildOptimalSquad } from '@/lib/algorithms';
import type { FPLPlayer, FPLTeam, FPLFixture, FPLBootstrap } from '@/types/fpl';
import type { BuiltSquad, SquadSlot, PlayerHistoryMap } from '@/lib/algorithms';

const TOTAL_BUDGET = 1000;
const POSITION_REQUIREMENTS: Record<number, number> = { 1: 2, 2: 5, 3: 5, 4: 3 };
const POSITION_LABELS: Record<number, string> = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' };
const MAX_PER_TEAM = 3;
const PITCH_ORDER = [4, 3, 2, 1];

const posRingColors: Record<number, string> = { 1: '#E8A317', 2: '#2196F3', 3: '#28A745', 4: '#DC3545' };

function formatPrice(tenths: number): string {
  return `£${(tenths / 10).toFixed(1)}m`;
}

function getFDRStyle(d: number): { bg: string; text: string } {
  const m: Record<number, { bg: string; text: string }> = {
    1: { bg: '#DAFBE1', text: '#1B873B' }, 2: { bg: '#C3F7CB', text: '#1B873B' },
    3: { bg: '#FFF4CC', text: '#BF8700' }, 4: { bg: '#FFCECB', text: '#CF222E' }, 5: { bg: '#F8B4B4', text: '#9E1B1B' },
  };
  return m[d] || { bg: '#E0E3E8', text: '#5F6672' };
}

function avgFDRLabel(avg: number): { text: string; color: string } {
  if (avg <= 2.2) return { text: 'Excellent', color: 'var(--semantic-green-600)' };
  if (avg <= 2.8) return { text: 'Good', color: 'var(--semantic-green-600)' };
  if (avg <= 3.2) return { text: 'Mixed', color: 'var(--semantic-amber-600)' };
  if (avg <= 3.8) return { text: 'Tough', color: 'var(--semantic-red-600)' };
  return { text: 'Very Tough', color: 'var(--semantic-red-600)' };
}

type Mode = 'auto' | 'pick';

export default function SquadBuilderPage() {
  const [bootstrap, setBootstrap] = useState<FPLBootstrap | null>(null);
  const [fixtures, setFixtures] = useState<FPLFixture[]>([]);
  const [historyMap, setHistoryMap] = useState<PlayerHistoryMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [buildingSquad, setBuildingSquad] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>('auto');
  const [builtSquad, setBuiltSquad] = useState<BuiltSquad | null>(null);
  const [lockedPlayers, setLockedPlayers] = useState<FPLPlayer[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [positionFilter, setPositionFilter] = useState<number | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const teamMap = useMemo(() => new Map(bootstrap?.teams.map(t => [t.id, t]) ?? []), [bootstrap]);
  const playerMap = useMemo(() => new Map(bootstrap?.elements.map(p => [p.id, p]) ?? []), [bootstrap]);

  const lockedPositionCounts = useMemo(() => {
    const c: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const p of lockedPlayers) c[p.element_type]++;
    return c;
  }, [lockedPlayers]);

  const lockedTeamCounts = useMemo(() => {
    const c = new Map<number, number>();
    for (const p of lockedPlayers) c.set(p.team, (c.get(p.team) || 0) + 1);
    return c;
  }, [lockedPlayers]);

  const lockedCost = useMemo(() => lockedPlayers.reduce((s, p) => s + p.now_cost, 0), [lockedPlayers]);
  const remainingBudget = TOTAL_BUDGET - lockedCost;

  const squadPositionCounts = useMemo(() => {
    const c: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    if (!builtSquad) return c;
    for (const slot of builtSquad.slots) if (slot.player) c[slot.position]++;
    return c;
  }, [builtSquad]);

  const displayPositionCounts = builtSquad ? squadPositionCounts : lockedPositionCounts;

  const searchResults = useMemo(() => {
    if (!bootstrap || !searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return bootstrap.elements
      .filter(p => {
        if (!p.web_name.toLowerCase().includes(q)) return false;
        if (positionFilter !== null && p.element_type !== positionFilter) return false;
        if (lockedPlayers.some(lp => lp.id === p.id)) return false;
        if (p.status === 'i' || p.status === 'u' || p.status === 's') return false;
        if (lockedPositionCounts[p.element_type] >= POSITION_REQUIREMENTS[p.element_type]) return false;
        if ((lockedTeamCounts.get(p.team) || 0) >= MAX_PER_TEAM) return false;
        if (p.now_cost > remainingBudget) return false;
        return true;
      })
      .sort((a, b) => parseFloat(b.selected_by_percent) - parseFloat(a.selected_by_percent))
      .slice(0, 20);
  }, [bootstrap, searchQuery, positionFilter, lockedPlayers, lockedPositionCounts, lockedTeamCounts, remainingBudget]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    async function fetchBase() {
      try {
        const [bsRes, fxRes] = await Promise.all([fetch('/api/fpl/bootstrap'), fetch('/api/fpl/fixtures')]);
        if (!bsRes.ok || !fxRes.ok) throw new Error('Failed to fetch FPL data');
        setBootstrap(await bsRes.json());
        setFixtures(await fxRes.json());
      } catch { setError('Failed to load FPL data.'); } finally { setLoading(false); }
    }
    fetchBase();
  }, []);

  const fetchHistory = useCallback(async (players: FPLPlayer[]) => {
    if (historyMap) return historyMap;
    setHistoryLoading(true);
    try {
      const top = [...players].filter(p => p.status === 'a').sort((a, b) => parseFloat(b.selected_by_percent) - parseFloat(a.selected_by_percent)).slice(0, 200);
      const batches = [];
      for (let i = 0; i < top.length; i += 50) batches.push(top.slice(i, i + 50).map(p => p.id));
      const responses = await Promise.all(batches.map(ids => fetch('/api/fpl/history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playerIds: ids }) })));
      let combined: PlayerHistoryMap = {};
      for (const res of responses) if (res.ok) combined = { ...combined, ...(await res.json()) };
      setHistoryMap(combined);
      return combined;
    } catch { return {} as PlayerHistoryMap; } finally { setHistoryLoading(false); }
  }, [historyMap]);

  const handleBuildSquad = useCallback(async (locked: FPLPlayer[]) => {
    if (!bootstrap || !fixtures.length) return;
    setBuildingSquad(true);
    try {
      const history = await fetchHistory(bootstrap.elements);
      const lockedInput = locked.map(p => ({ id: p.id, position: p.element_type }));
      setBuiltSquad(buildOptimalSquad(bootstrap.elements, bootstrap.teams, fixtures, bootstrap.events, lockedInput, TOTAL_BUDGET, history));
    } catch { setError('Failed to build squad.'); } finally { setBuildingSquad(false); }
  }, [bootstrap, fixtures, fetchHistory]);

  function addLockedPlayer(player: FPLPlayer) {
    if (lockedPlayers.some(p => p.id === player.id)) return;
    if (lockedPositionCounts[player.element_type] >= POSITION_REQUIREMENTS[player.element_type]) return;
    if ((lockedTeamCounts.get(player.team) || 0) >= MAX_PER_TEAM) return;
    if (player.now_cost > remainingBudget) return;
    setLockedPlayers(prev => [...prev, player]);
    setSearchQuery('');
    setSearchOpen(false);
    setBuiltSquad(null);
  }

  function removeLockedPlayer(playerId: number) {
    setLockedPlayers(prev => prev.filter(p => p.id !== playerId));
    setBuiltSquad(null);
  }

  function handleModeSwitch(newMode: Mode) {
    setMode(newMode);
    setBuiltSquad(null);
    if (newMode === 'auto') setLockedPlayers([]);
  }

  const pitchRows = useMemo(() => {
    if (!builtSquad) return null;
    const rows: Record<number, SquadSlot[]> = { 1: [], 2: [], 3: [], 4: [] };
    for (const slot of builtSquad.slots) rows[slot.position]?.push(slot);
    return rows;
  }, [builtSquad]);

  const positionScores = useMemo(() => {
    const s: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    if (!builtSquad) return s;
    for (const slot of builtSquad.slots) s[slot.position] = (s[slot.position] || 0) + slot.score;
    return s;
  }, [builtSquad]);

  if (loading) return <LoadingSpinner message="Loading FPL data..." />;
  if (error && !bootstrap) return <EmptyState variant="error" title="Error" description={error} />;

  const isSquadComplete = builtSquad && builtSquad.slots.every(s => s.player !== null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Squad Builder"
        subtitle={mode === 'auto' ? 'Generate the optimal predicted XV within budget' : 'Lock your preferred players, auto-fill the rest'}
        actions={
          <div className="segmented-control">
            <button className={mode === 'auto' ? 'active' : ''} onClick={() => handleModeSwitch('auto')}>Auto Build</button>
            <button className={mode === 'pick' ? 'active' : ''} onClick={() => handleModeSwitch('pick')}>Pick & Fill</button>
          </div>
        }
      />

      {/* Budget bar */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm-design font-medium" style={{ color: 'var(--text-secondary)' }}>Budget</span>
          <div className="flex items-center gap-3 text-sm-design">
            <span style={{ color: 'var(--text-secondary)' }}>Spent: <span className="mono font-medium" style={{ color: 'var(--text-primary)' }}>{formatPrice(builtSquad ? builtSquad.totalCost : lockedCost)}</span></span>
            <span style={{ color: 'var(--text-secondary)' }}>Remaining: <span className="mono font-medium" style={{ color: (builtSquad ? builtSquad.remainingBudget : remainingBudget) < 0 ? 'var(--semantic-red-600)' : 'var(--semantic-green-600)' }}>{formatPrice(builtSquad ? builtSquad.remainingBudget : remainingBudget)}</span></span>
          </div>
        </div>
        <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-sunken)' }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, ((builtSquad ? builtSquad.totalCost : lockedCost) / TOTAL_BUDGET) * 100)}%`, background: 'var(--semantic-blue-500)' }} />
        </div>
      </div>

      {/* Position requirements */}
      <div className="flex flex-wrap gap-3">
        {([1, 2, 3, 4] as number[]).map(pos => {
          const filled = displayPositionCounts[pos];
          const required = POSITION_REQUIREMENTS[pos];
          const isFull = filled >= required;
          return (
            <div key={pos} className="flex items-center gap-2 px-4 py-2 rounded-md-design border" style={{
              background: isFull ? 'var(--semantic-green-50)' : 'var(--surface-raised)',
              borderColor: isFull ? 'var(--semantic-green-100)' : 'var(--border-subtle)',
            }}>
              <span className="text-sm-design font-bold" style={{ color: isFull ? 'var(--semantic-green-600)' : 'var(--text-primary)' }}>{POSITION_LABELS[pos]}</span>
              <span className="mono text-sm-design" style={{ color: isFull ? 'var(--semantic-green-600)' : 'var(--text-secondary)' }}>{filled}/{required}</span>
              {isFull && <Check size={14} style={{ color: 'var(--semantic-green-600)' }} />}
            </div>
          );
        })}
      </div>

      {/* Search (Pick mode) */}
      {mode === 'pick' && (
        <div className="card space-y-4">
          <h2 className="text-base-design font-semibold" style={{ color: 'var(--text-primary)' }}>Search & Lock Players</h2>

          <div className="segmented-control">
            {[{ label: 'All', value: null }, { label: 'GKP', value: 1 }, { label: 'DEF', value: 2 }, { label: 'MID', value: 3 }, { label: 'FWD', value: 4 }].map(f => (
              <button key={f.label} onClick={() => setPositionFilter(f.value)} className={positionFilter === f.value ? 'active' : ''}>{f.label}</button>
            ))}
          </div>

          <div ref={searchRef} className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
            <input type="text" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }} onFocus={() => setSearchOpen(true)} placeholder="Search by player name..." className="input-field w-full pl-8" />

            {searchOpen && searchQuery.trim() && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 rounded-md-design border shadow-level-3 z-30 max-h-72 overflow-y-auto" style={{ background: 'var(--surface-raised)', borderColor: 'var(--border-subtle)' }}>
                {searchResults.map(player => {
                  const team = teamMap.get(player.team);
                  const posLabel = POSITION_MAP[player.element_type];
                  const posClass = posLabel === 'GKP' ? 'pos-chip-gkp' : posLabel === 'DEF' ? 'pos-chip-def' : posLabel === 'MID' ? 'pos-chip-mid' : 'pos-chip-fwd';
                  return (
                    <button key={player.id} onClick={() => addLockedPlayer(player)} className="w-full flex items-center justify-between px-4 py-2.5 transition-colors text-left" style={{ borderBottom: '1px solid var(--row-divider)' }}>
                      <div className="flex items-center gap-3">
                        <span className={`${posClass} text-[10px] font-medium px-1.5 py-0.5 rounded-sm-design`}>{posLabel}</span>
                        <span className="text-sm-design font-medium" style={{ color: 'var(--text-primary)' }}>{player.web_name}</span>
                        <span className="text-xs-design" style={{ color: 'var(--text-tertiary)' }}>{team?.short_name ?? ''}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs-design" style={{ color: 'var(--text-tertiary)' }}>{parseFloat(player.selected_by_percent).toFixed(1)}% sel</span>
                        <span className="mono text-sm-design font-medium" style={{ color: 'var(--semantic-blue-600)' }}>{formatPrice(player.now_cost)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {lockedPlayers.length > 0 && (
            <div className="space-y-2">
              <p className="micro-label">Locked Players ({lockedPlayers.length}/15)</p>
              <div className="flex flex-wrap gap-2">
                {lockedPlayers.map(player => {
                  const team = teamMap.get(player.team);
                  return (
                    <div key={player.id} className="flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-md-design border" style={{ background: 'var(--semantic-green-50)', borderColor: 'var(--semantic-green-100)' }}>
                      <Lock size={10} style={{ color: 'var(--semantic-green-600)' }} />
                      <span className="text-sm-design font-medium" style={{ color: 'var(--text-primary)' }}>{player.web_name}</span>
                      <span className="text-xs-design" style={{ color: 'var(--text-tertiary)' }}>{team?.short_name}</span>
                      <span className="mono text-xs-design" style={{ color: 'var(--semantic-blue-600)' }}>{formatPrice(player.now_cost)}</span>
                      <button onClick={() => removeLockedPlayer(player.id)} className="ml-1 w-5 h-5 rounded-full flex items-center justify-center transition-colors" style={{ background: 'var(--semantic-red-100)', color: 'var(--semantic-red-600)' }}>
                        <X size={10} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Build button */}
      <div className="flex justify-center">
        <button
          onClick={() => handleBuildSquad(mode === 'auto' ? [] : lockedPlayers)}
          disabled={buildingSquad || historyLoading || !bootstrap}
          className="btn-primary px-8 py-3 text-base-design font-semibold disabled:opacity-50"
        >
          {buildingSquad || historyLoading
            ? (historyLoading ? 'Loading player history...' : mode === 'auto' ? 'Building optimal squad...' : 'Filling remaining slots...')
            : mode === 'auto' ? 'Auto Build Best XV' : `Fill Remaining ${15 - lockedPlayers.length} Slots`}
        </button>
      </div>

      {error && bootstrap && (
        <div className="rounded-md-design p-3 border" style={{ background: 'var(--semantic-red-50)', borderColor: 'var(--semantic-red-100)' }}>
          <p className="text-sm-design" style={{ color: 'var(--semantic-red-600)' }}>{error}</p>
        </div>
      )}

      {/* Pitch view */}
      {builtSquad && pitchRows ? (
        <div className="card">
          <div className="pitch-stripes rounded-lg-design p-6 space-y-6">
            {PITCH_ORDER.map(pos => {
              const slots = pitchRows[pos] || [];
              if (!slots.length) return null;
              return (
                <div key={pos} className="flex justify-center gap-3 flex-wrap">
                  {slots.map((slot, idx) => (
                    <PitchNode key={slot.player?.id ?? `e-${pos}-${idx}`} slot={slot} teamMap={teamMap} mode={mode} onRemove={mode === 'pick' && slot.locked ? () => removeLockedPlayer(slot.player!.id) : undefined} />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      ) : !buildingSquad && (
        <div className="card">
          <div className="pitch-stripes rounded-lg-design p-6 space-y-6">
            {PITCH_ORDER.map(pos => {
              const lockedInPos = lockedPlayers.filter(p => p.element_type === pos);
              const emptyCount = POSITION_REQUIREMENTS[pos] - lockedInPos.length;
              return (
                <div key={pos} className="flex justify-center gap-3 flex-wrap">
                  {lockedInPos.map(player => (
                    <div key={player.id} className="flex flex-col items-center min-w-[80px]">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--surface-raised)', border: `2.5px solid ${posRingColors[player.element_type]}`, boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }}>
                        <Lock size={14} style={{ color: 'var(--semantic-green-600)' }} />
                      </div>
                      <span className="text-xs-design font-medium mt-1 text-white truncate max-w-[80px]">{player.web_name}</span>
                      <span className="mono text-[10px] text-white/70">{formatPrice(player.now_cost)}</span>
                    </div>
                  ))}
                  {Array.from({ length: emptyCount }).map((_, i) => (
                    <div key={`e-${pos}-${i}`} className="flex flex-col items-center min-w-[80px]">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center border-2 border-dashed" style={{ borderColor: 'rgba(255,255,255,0.25)' }}>
                        <span className="text-[10px] text-white/50">{POSITION_LABELS[pos]}</span>
                      </div>
                      <span className="text-[10px] text-white/40 mt-1">Empty</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Squad summary */}
      {isSquadComplete && builtSquad && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="text-base-design font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Squad Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="rounded-md-design p-4 text-center" style={{ background: 'var(--surface-sunken)' }}>
                <p className="mono text-xl-design font-bold" style={{ color: 'var(--semantic-green-600)' }}>{builtSquad.predictedPoints.toFixed(1)}</p>
                <p className="micro-label mt-1">Total xPts (5 GW)</p>
              </div>
              <div className="rounded-md-design p-4 text-center" style={{ background: 'var(--surface-sunken)' }}>
                <p className="mono text-xl-design font-bold" style={{ color: 'var(--semantic-blue-600)' }}>{formatPrice(builtSquad.totalCost)}</p>
                <p className="micro-label mt-1">Total Cost</p>
              </div>
              <div className="rounded-md-design p-4 text-center" style={{ background: 'var(--surface-sunken)' }}>
                <p className="mono text-xl-design font-bold" style={{ color: 'var(--text-primary)' }}>{formatPrice(builtSquad.remainingBudget)}</p>
                <p className="micro-label mt-1">Remaining</p>
              </div>
              <div className="rounded-md-design p-4 text-center" style={{ background: 'var(--surface-sunken)' }}>
                <p className="mono text-xl-design font-bold" style={{ color: 'var(--text-primary)' }}>{builtSquad.slots.filter(s => s.locked).length}</p>
                <p className="micro-label mt-1">Locked Picks</p>
              </div>
            </div>

            {/* Position breakdown */}
            <h3 className="micro-label mb-3">xPts by Position (next 5 GW)</h3>
            <div className="space-y-2 mb-6">
              {([1, 2, 3, 4] as number[]).map(pos => {
                const score = positionScores[pos] || 0;
                const maxPosScore = Math.max(...Object.values(positionScores), 1);
                return (
                  <div key={pos} className="flex items-center gap-3">
                    <span className="text-xs-design font-bold w-8" style={{ color: 'var(--text-secondary)' }}>{POSITION_LABELS[pos]}</span>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-sunken)' }}>
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(score / maxPosScore) * 100}%`, background: posRingColors[pos] }} />
                    </div>
                    <span className="mono text-xs-design w-12 text-right" style={{ color: 'var(--text-secondary)' }}>{score.toFixed(1)}</span>
                  </div>
                );
              })}
            </div>

            {/* Player detail rows */}
            <h3 className="micro-label mb-3">Player Selection Rationale</h3>
            <div className="space-y-2">
              {builtSquad.slots.filter(s => s.player).sort((a, b) => a.position - b.position || b.score - a.score).map(slot => {
                const player = slot.player!;
                const team = slot.team;
                const bd = slot.breakdown;
                const posLabel = POSITION_MAP[player.element_type];
                const posClass = posLabel === 'GKP' ? 'pos-chip-gkp' : posLabel === 'DEF' ? 'pos-chip-def' : posLabel === 'MID' ? 'pos-chip-mid' : 'pos-chip-fwd';

                return (
                  <div key={player.id} className="rounded-md-design border p-3" style={{ background: 'var(--surface-sunken)', borderColor: 'var(--border-subtle)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {slot.locked && <Lock size={12} style={{ color: 'var(--semantic-green-600)' }} />}
                        <span className={`${posClass} text-[10px] font-medium px-1.5 py-0.5 rounded-sm-design`}>{posLabel}</span>
                        <span className="text-sm-design font-bold" style={{ color: 'var(--text-primary)' }}>{player.web_name}</span>
                        <span className="text-xs-design" style={{ color: 'var(--text-tertiary)' }}>{team?.short_name ?? ''}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="mono text-xs-design" style={{ color: 'var(--semantic-blue-600)' }}>{formatPrice(player.now_cost)}</span>
                        <span className="mono text-sm-design font-bold rounded-sm-design px-2 py-0.5" style={{ background: 'var(--surface-raised)', color: 'var(--text-primary)' }}>{slot.score.toFixed(1)} xPts</span>
                      </div>
                    </div>
                    {bd && (
                      <>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <div className="flex-1 space-y-1">
                            <BreakdownBar label="Goals/Assists" value={bd.fixtureScore} max={25} color="var(--viz-steel)" />
                            <BreakdownBar label="Mins/Bonus" value={bd.formScore} max={15} color="var(--semantic-green-500)" />
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {bd.fixtures.slice(0, 5).map((fx, i) => (
                              <div key={i} className="flex flex-col items-center">
                                <FDRBadge difficulty={fx.difficulty} compact />
                                <span className="text-[8px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{fx.opponent}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        {bd.reasons.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {bd.reasons.map((r, i) => <span key={i} className="badge-blue text-[10px]">{r}</span>)}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ────────────────── Sub-components ────────────────── */

function PitchNode({ slot, teamMap, mode, onRemove }: { slot: SquadSlot; teamMap: Map<number, FPLTeam>; mode: Mode; onRemove?: () => void }) {
  if (!slot.player) {
    return (
      <div className="flex flex-col items-center min-w-[80px]">
        <div className="w-10 h-10 rounded-full flex items-center justify-center border-2 border-dashed" style={{ borderColor: 'rgba(255,255,255,0.25)' }}>
          <span className="text-[10px] text-white/50">{POSITION_LABELS[slot.position]}</span>
        </div>
        <span className="text-[10px] text-white/40 mt-1">Empty</span>
      </div>
    );
  }

  const player = slot.player;
  const team = teamMap.get(player.team);
  const ringColor = posRingColors[player.element_type];
  const bd = slot.breakdown;

  return (
    <div className="flex flex-col items-center min-w-[80px]">
      <div className="relative">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm-design font-semibold" style={{
          background: 'var(--surface-raised)',
          border: `2.5px solid ${slot.locked ? 'var(--semantic-green-500)' : ringColor}`,
          color: 'var(--text-primary)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
        }}>
          {slot.score.toFixed(0)}
        </div>
        {onRemove && (
          <button onClick={onRemove} className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: 'var(--semantic-red-500)', color: '#fff' }}>
            <X size={8} />
          </button>
        )}
      </div>
      <span className="text-xs-design font-medium mt-1 text-white truncate max-w-[80px]">{player.web_name}</span>
      <span className="mono text-[10px] text-white/70">{formatPrice(player.now_cost)}</span>
      {bd && bd.fixtures.length > 0 && (
        <div className="flex gap-0.5 mt-0.5">
          {bd.fixtures.slice(0, 5).map((fx, i) => {
            const s = getFDRStyle(fx.difficulty);
            return <div key={i} className="w-2.5 h-1.5 rounded-sm" style={{ background: s.bg }} />;
          })}
        </div>
      )}
    </div>
  );
}

function BreakdownBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] w-20 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>{label}</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-ground)' }}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }} />
      </div>
      <span className="mono text-[10px] w-8 text-right" style={{ color: 'var(--text-secondary)' }}>{value.toFixed(1)}</span>
    </div>
  );
}
