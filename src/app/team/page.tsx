'use client';

import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import StatCard from '@/components/StatCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import FDRBadge from '@/components/FDRBadge';
import { AlertTriangle, Users } from 'lucide-react';
import { POSITION_MAP, POSITION_FULL, STATUS_MAP } from '@/types/fpl';
import type {
  FPLPlayer, FPLTeam, FPLEvent, FPLFixture, FPLBootstrap,
  FPLManager, FPLManagerHistory, FPLManagerPicks, FPLTransfer, FPLPick,
} from '@/types/fpl';

interface EnrichedPick extends FPLPick {
  player: FPLPlayer;
  team: FPLTeam;
}

const posRingColors: Record<number, string> = {
  1: '#E8A317', // GKP
  2: '#2196F3', // DEF
  3: '#28A745', // MID
  4: '#DC3545', // FWD
};

export default function TeamPage() {
  const [teamId, setTeamId] = useState('');
  const [inputId, setInputId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [bootstrap, setBootstrap] = useState<FPLBootstrap | null>(null);
  const [fixtures, setFixtures] = useState<FPLFixture[]>([]);
  const [manager, setManager] = useState<FPLManager | null>(null);
  const [history, setHistory] = useState<FPLManagerHistory | null>(null);
  const [picks, setPicks] = useState<FPLManagerPicks | null>(null);
  const [transfers, setTransfers] = useState<FPLTransfer[]>([]);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('fpl-team-id') : null;
    if (stored) { setTeamId(stored); setInputId(stored); }
  }, []);

  useEffect(() => {
    async function fetchBase() {
      try {
        const [bsRes, fxRes] = await Promise.all([fetch('/api/fpl/bootstrap'), fetch('/api/fpl/fixtures')]);
        if (!bsRes.ok || !fxRes.ok) throw new Error('Failed to fetch FPL data');
        setBootstrap(await bsRes.json());
        setFixtures(await fxRes.json());
      } catch { setError('Failed to load base FPL data'); }
    }
    fetchBase();
  }, []);

  useEffect(() => {
    if (!teamId) return;
    async function fetchManager() {
      setLoading(true); setError(null);
      try {
        const [mgrRes, histRes, picksRes, trRes] = await Promise.all([
          fetch(`/api/fpl/entry/${teamId}?type=info`),
          fetch(`/api/fpl/entry/${teamId}?type=history`),
          fetch(`/api/fpl/entry/${teamId}?type=picks`),
          fetch(`/api/fpl/entry/${teamId}?type=transfers`),
        ]);
        if (!mgrRes.ok) throw new Error('Invalid Team ID or failed to load manager data');
        setManager(await mgrRes.json());
        setHistory(histRes.ok ? await histRes.json() : null);
        setPicks(picksRes.ok ? await picksRes.json() : null);
        setTransfers(trRes.ok ? await trRes.json() : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load team data');
        setManager(null); setHistory(null); setPicks(null); setTransfers([]);
      } finally { setLoading(false); }
    }
    fetchManager();
  }, [teamId]);

  function handleAnalyse() {
    const id = inputId.trim();
    if (!id || isNaN(Number(id))) return;
    localStorage.setItem('fpl-team-id', id);
    setTeamId(id);
  }

  const playerMap = useMemo(() => {
    if (!bootstrap) return new Map<number, FPLPlayer>();
    return new Map(bootstrap.elements.map(p => [p.id, p]));
  }, [bootstrap]);

  const teamMap = useMemo(() => {
    if (!bootstrap) return new Map<number, FPLTeam>();
    return new Map(bootstrap.teams.map(t => [t.id, t]));
  }, [bootstrap]);

  const currentEvent = useMemo(() => {
    if (!bootstrap) return null;
    return bootstrap.events.find(e => e.is_current) ?? bootstrap.events.find(e => e.is_next) ?? null;
  }, [bootstrap]);

  const nextEvent = useMemo(() => {
    if (!bootstrap) return null;
    return bootstrap.events.find(e => e.is_next) ?? null;
  }, [bootstrap]);

  const enrichedPicks = useMemo<EnrichedPick[]>(() => {
    if (!picks) return [];
    return picks.picks
      .map(pick => {
        const player = playerMap.get(pick.element);
        const team = player ? teamMap.get(player.team) : undefined;
        if (!player || !team) return null;
        return { ...pick, player, team };
      })
      .filter(Boolean) as EnrichedPick[];
  }, [picks, playerMap, teamMap]);

  const startingXI = enrichedPicks.filter(p => p.position <= 11);
  const bench = enrichedPicks.filter(p => p.position > 11);

  const positionGroups = useMemo(() => {
    const groups: Record<number, EnrichedPick[]> = { 1: [], 2: [], 3: [], 4: [] };
    startingXI.forEach(p => { if (groups[p.player.element_type]) groups[p.player.element_type].push(p); });
    return groups;
  }, [startingXI]);

  const positionalBreakdown = useMemo(() => {
    if (!enrichedPicks.length) return [];
    const totalTeamPts = enrichedPicks.reduce((s, p) => s + p.player.total_points, 0);
    return [1, 2, 3, 4].map(pos => {
      const players = enrichedPicks.filter(p => p.player.element_type === pos);
      const avgForm = players.length ? players.reduce((s, p) => s + (parseFloat(p.player.form) || 0), 0) / players.length : 0;
      const totalPts = players.reduce((s, p) => s + p.player.total_points, 0);
      const pctOfTotal = totalTeamPts > 0 ? (totalPts / totalTeamPts) * 100 : 0;
      return { position: pos, count: players.length, avgForm, totalPts, pctOfTotal };
    });
  }, [enrichedPicks]);

  const weaknesses = useMemo(() => {
    if (!enrichedPicks.length) return { injured: [] as EnrichedPick[], poorForm: [] as EnrichedPick[], toughFixtures: [] as EnrichedPick[], yellowRisk: [] as EnrichedPick[] };
    const injured = enrichedPicks.filter(p => p.player.status !== 'a');
    const poorForm = enrichedPicks.filter(p => parseFloat(p.player.form) < 3 && p.player.status === 'a');
    const toughFixtures = enrichedPicks.filter(p => {
      if (!nextEvent) return false;
      const upcoming = fixtures.filter(f => f.event === nextEvent.id && (f.team_h === p.player.team || f.team_a === p.player.team));
      return upcoming.some(f => { const diff = f.team_h === p.player.team ? f.team_h_difficulty : f.team_a_difficulty; return diff >= 4; });
    });
    const currentGW = currentEvent?.id ?? 0;
    const yellowRisk = enrichedPicks.filter(p => {
      const yc = p.player.yellow_cards;
      if (currentGW < 19 && yc >= 4) return true;
      if (currentGW < 32 && yc >= 9) return true;
      return false;
    });
    return { injured, poorForm, toughFixtures, yellowRisk };
  }, [enrichedPicks, fixtures, nextEvent, currentEvent]);

  const chartData = useMemo(() => {
    if (!history?.current) return [];
    return history.current.map(gw => ({ gw: gw.event, points: gw.points, total: gw.total_points }));
  }, [history]);

  const gwAverage = useMemo(() => {
    if (!chartData.length) return 0;
    return Math.round(chartData.reduce((s, d) => s + d.points, 0) / chartData.length);
  }, [chartData]);

  const chipsUsed = useMemo(() => history?.chips ?? [], [history]);
  const allChips = ['wildcard', 'freehit', 'bboost', '3xc'];
  const chipLabels: Record<string, string> = { wildcard: 'Wildcard', freehit: 'Free Hit', bboost: 'Bench Boost', '3xc': 'Triple Captain' };

  const recentTransfers = useMemo(() => {
    return [...transfers].sort((a, b) => b.event - a.event || new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 10);
  }, [transfers]);

  // No team loaded
  if (!manager && !loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Team Analyser" subtitle="Detailed squad analysis and performance insights" />
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="card max-w-md w-full text-center space-y-6 p-8">
            <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center" style={{ background: 'var(--semantic-blue-50)' }}>
              <Users size={24} style={{ color: 'var(--semantic-blue-500)' }} />
            </div>
            <div>
              <h2 className="text-lg-design font-semibold" style={{ color: 'var(--text-primary)' }}>Enter Your FPL Team ID</h2>
              <p className="text-sm-design mt-2" style={{ color: 'var(--text-secondary)' }}>
                Find your Team ID on the FPL website under the Points or Transfers tab URL.
              </p>
            </div>
            <div className="space-y-3">
              <input type="number" placeholder="e.g. 1234567" value={inputId} onChange={e => setInputId(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAnalyse()} className="input-field w-full text-center text-lg-design" />
              <button onClick={handleAnalyse} className="btn-primary w-full">Analyse Team</button>
            </div>
            {error && <p className="text-sm-design" style={{ color: 'var(--semantic-red-600)' }}>{error}</p>}
          </div>
        </div>
      </div>
    );
  }

  if (loading) return <LoadingSpinner message="Analysing your squad..." />;
  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Team Analyser" />
        <EmptyState variant="error" title="Error" description={error} action={
          <button onClick={() => { setTeamId(''); setManager(null); setError(null); }} className="btn-secondary">Try Again</button>
        } />
      </div>
    );
  }

  const entryHistory = picks?.entry_history;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Analyser"
        subtitle={manager ? `${manager.player_first_name} ${manager.player_last_name} — ${manager.name}` : undefined}
        actions={
          <div className="flex items-center gap-2">
            <input type="number" placeholder="Team ID" value={inputId} onChange={e => setInputId(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAnalyse()} className="input-field w-28" />
            <button onClick={handleAnalyse} className="btn-primary">Analyse</button>
          </div>
        }
      />

      {/* Six-up stat strip */}
      {entryHistory && (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard label="Overall Points" value={manager?.summary_overall_points?.toLocaleString() ?? '--'} />
          <StatCard label="Overall Rank" value={manager?.summary_overall_rank?.toLocaleString() ?? '--'} />
          <StatCard label="Squad Value" value={`£${(entryHistory.value / 10).toFixed(1)}m`} />
          <StatCard label="In The Bank" value={`£${(entryHistory.bank / 10).toFixed(1)}m`} />
          <StatCard label="GW Points" value={manager?.summary_event_points ?? '--'} />
          <StatCard label="Active Chip" value={picks?.active_chip ? chipLabels[picks.active_chip] || picks.active_chip : 'None'} />
        </div>
      )}

      {/* Pitch + Weaknesses */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Pitch card */}
        {enrichedPicks.length > 0 && (
          <div className="card">
            <h2 className="text-base-design font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Squad View</h2>
            <div className="pitch-stripes rounded-lg-design p-4 md:p-6">
              {[1, 2, 3, 4].map(pos => (
                <div key={pos} className="flex justify-center gap-2 md:gap-4 mb-4 last:mb-0 flex-wrap">
                  {positionGroups[pos]?.map(pick => (
                    <PlayerNode key={pick.element} pick={pick} />
                  ))}
                </div>
              ))}
            </div>
            <div className="mt-3">
              <p className="micro-label mb-2">Bench</p>
              <div className="flex gap-2 md:gap-3 flex-wrap">
                {bench.map(pick => (
                  <PlayerNode key={pick.element} pick={pick} isBench />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Weaknesses + Positional Strength */}
        <div className="space-y-4">
          {/* Weakness cards */}
          <div className="card">
            <h2 className="text-base-design font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Squad Alerts</h2>
            <div className="space-y-2">
              {weaknesses.injured.length > 0 && (
                <WeaknessAlert title="Injured / Doubtful" variant="red"
                  items={weaknesses.injured.map(p => ({ name: p.player.web_name, detail: STATUS_MAP[p.player.status]?.label ?? 'Unknown' }))} />
              )}
              {weaknesses.poorForm.length > 0 && (
                <WeaknessAlert title="Poor Form (< 3.0)" variant="amber"
                  items={weaknesses.poorForm.map(p => ({ name: p.player.web_name, detail: `Form: ${p.player.form}` }))} />
              )}
              {weaknesses.toughFixtures.length > 0 && (
                <WeaknessAlert title="Tough Fixtures Next GW" variant="amber"
                  items={weaknesses.toughFixtures.map(p => ({ name: p.player.web_name, detail: teamMap.get(p.player.team)?.short_name ?? '' }))} />
              )}
              {weaknesses.yellowRisk.length > 0 && (
                <WeaknessAlert title="Suspension Risk" variant="amber"
                  items={weaknesses.yellowRisk.map(p => ({ name: p.player.web_name, detail: `${p.player.yellow_cards} yellows` }))} />
              )}
              {weaknesses.injured.length === 0 && weaknesses.poorForm.length === 0 &&
               weaknesses.toughFixtures.length === 0 && weaknesses.yellowRisk.length === 0 && (
                <p className="text-sm-design" style={{ color: 'var(--semantic-green-600)' }}>No major weaknesses detected.</p>
              )}
            </div>
          </div>

          {/* Positional strength bars */}
          <div className="card">
            <h2 className="text-base-design font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Positional Strength</h2>
            <div className="space-y-3">
              {positionalBreakdown.map(row => (
                <div key={row.position}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm-design font-medium" style={{ color: 'var(--text-primary)' }}>{POSITION_FULL[row.position]}</span>
                    <span className="mono text-xs-design" style={{ color: 'var(--text-secondary)' }}>{row.totalPts} pts ({row.pctOfTotal.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-sunken)' }}>
                    <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(100, row.pctOfTotal)}%`, background: posRingColors[row.position] }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* GW bar chart */}
      {chartData.length > 0 && (
        <div className="card">
          <h2 className="text-base-design font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Gameweek Points</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
              <XAxis dataKey="gw" tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} tickFormatter={v => `${v}`} stroke="var(--border-subtle)" />
              <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} stroke="var(--border-subtle)" />
              <Tooltip
                contentStyle={{
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.10)',
                }}
                labelFormatter={v => `Gameweek ${v}`}
              />
              <ReferenceLine y={gwAverage} stroke="var(--semantic-blue-500)" strokeDasharray="5 5"
                label={{ value: `Avg: ${gwAverage}`, fill: 'var(--semantic-blue-500)', fontSize: 11, position: 'right' }} />
              <Bar dataKey="points" fill="#4C72B0" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Chips + Transfers */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-base-design font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Chips Status</h2>
          <div className="grid grid-cols-2 gap-3">
            {allChips.map(chip => {
              const used = chipsUsed.find(c => c.name === chip);
              return (
                <div key={chip} className="rounded-md-design p-3 border" style={{
                  background: used ? 'var(--surface-sunken)' : 'var(--semantic-green-50)',
                  borderColor: used ? 'var(--border-subtle)' : 'var(--semantic-green-100)',
                  opacity: used ? 0.7 : 1,
                }}>
                  <p className="text-sm-design font-semibold" style={{ color: used ? 'var(--text-tertiary)' : 'var(--semantic-green-600)' }}>
                    {chipLabels[chip] || chip}
                  </p>
                  <p className="text-xs-design mt-0.5" style={{ color: used ? 'var(--text-tertiary)' : 'var(--semantic-green-600)' }}>
                    {used ? `Used GW${used.event}` : 'Available'}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <h2 className="text-base-design font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Recent Transfers</h2>
          {recentTransfers.length === 0 ? (
            <p className="text-sm-design" style={{ color: 'var(--text-tertiary)' }}>No transfers made yet.</p>
          ) : (
            <div className="space-y-1.5">
              {recentTransfers.map((tr, idx) => {
                const pOut = playerMap.get(tr.element_out);
                const pIn = playerMap.get(tr.element_in);
                return (
                  <div key={idx} className="flex items-center gap-3 py-1.5" style={{ borderBottom: '1px solid var(--row-divider)' }}>
                    <span className="mono text-xs-design w-8" style={{ color: 'var(--text-tertiary)' }}>GW{tr.event}</span>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-sm-design truncate" style={{ color: 'var(--semantic-red-600)' }}>{pOut?.web_name ?? `#${tr.element_out}`}</span>
                      <span className="mono text-xs-design" style={{ color: 'var(--text-tertiary)' }}>{'£'}{(tr.element_out_cost / 10).toFixed(1)}</span>
                      <span style={{ color: 'var(--text-tertiary)' }}>→</span>
                      <span className="text-sm-design truncate" style={{ color: 'var(--semantic-green-600)' }}>{pIn?.web_name ?? `#${tr.element_in}`}</span>
                      <span className="mono text-xs-design" style={{ color: 'var(--text-tertiary)' }}>{'£'}{(tr.element_in_cost / 10).toFixed(1)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ────────────────── Sub-components ────────────────── */

function PlayerNode({ pick, isBench }: { pick: EnrichedPick; isBench?: boolean }) {
  const ringColor = posRingColors[pick.player.element_type] || '#9BA1AB';
  return (
    <div className="flex flex-col items-center min-w-[72px] md:min-w-[85px]">
      {/* Circle with position ring */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-sm-design font-semibold"
        style={{
          background: isBench ? 'var(--surface-sunken)' : 'var(--surface-raised)',
          border: `2.5px solid ${isBench ? 'var(--border-subtle)' : ringColor}`,
          color: 'var(--text-primary)',
          boxShadow: isBench ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
        }}
      >
        {pick.player.event_points}
      </div>
      <div className="flex items-center gap-0.5 mt-1">
        <span className="text-xs-design font-medium truncate max-w-[70px]" style={{ color: isBench ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>
          {pick.player.web_name}
        </span>
        {pick.is_captain && <span className="text-[9px] font-bold" style={{ color: 'var(--semantic-blue-600)' }}>(C)</span>}
        {pick.is_vice_captain && <span className="text-[9px] font-bold" style={{ color: 'var(--text-tertiary)' }}>(V)</span>}
      </div>
      <span className="mono text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{'£'}{(pick.player.now_cost / 10).toFixed(1)}</span>
    </div>
  );
}

function WeaknessAlert({ title, variant, items }: {
  title: string; variant: 'red' | 'amber';
  items: Array<{ name: string; detail: string }>;
}) {
  const isRed = variant === 'red';
  return (
    <div className="rounded-md-design p-3 border" style={{
      background: isRed ? 'var(--semantic-red-50)' : 'var(--semantic-amber-50)',
      borderColor: isRed ? 'var(--semantic-red-100)' : 'var(--semantic-amber-100)',
    }}>
      <p className="text-sm-design font-semibold mb-1" style={{ color: isRed ? 'var(--semantic-red-600)' : 'var(--semantic-amber-600)' }}>
        <AlertTriangle size={13} className="inline mr-1" style={{ verticalAlign: '-1px' }} />{title}
      </p>
      <div className="space-y-0.5">
        {items.map((item, idx) => (
          <p key={idx} className="text-xs-design">
            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{item.name}</span>
            <span className="ml-2" style={{ color: 'var(--text-secondary)' }}>{item.detail}</span>
          </p>
        ))}
      </div>
    </div>
  );
}
