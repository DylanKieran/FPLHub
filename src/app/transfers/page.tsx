'use client';

import { useState, useEffect, useMemo } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import FDRBadge from '@/components/FDRBadge';
import { ArrowLeftRight, Check } from 'lucide-react';
import { POSITION_MAP } from '@/types/fpl';
import { getTransferSuggestions, getDifferentials, getPriceChangePredictions } from '@/lib/algorithms';
import type { FPLPlayer, FPLTeam, FPLFixture, FPLBootstrap, FPLManagerPicks } from '@/types/fpl';
import type { TransferSuggestion, DifferentialPick, PriceChange } from '@/lib/algorithms';

type Tab = 'replacements' | 'differentials' | 'price-watch';

export default function TransfersPage() {
  const [bootstrap, setBootstrap] = useState<FPLBootstrap | null>(null);
  const [fixtures, setFixtures] = useState<FPLFixture[]>([]);
  const [picks, setPicks] = useState<FPLManagerPicks | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSquad, setLoadingSquad] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [teamId, setTeamId] = useState('');
  const [inputId, setInputId] = useState('');
  const [freeTransfers, setFreeTransfers] = useState(1);
  const [bank, setBank] = useState('0.0');
  const [maxOwnership, setMaxOwnership] = useState(10);

  const [suggestions, setSuggestions] = useState<TransferSuggestion[]>([]);
  const [differentials, setDifferentials] = useState<DifferentialPick[]>([]);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('replacements');

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
      } catch { setError('Failed to load base FPL data'); } finally { setLoading(false); }
    }
    fetchBase();
  }, []);

  useEffect(() => {
    if (!teamId) return;
    async function fetchPicks() {
      setLoadingSquad(true);
      try {
        const res = await fetch(`/api/fpl/entry/${teamId}?type=picks`);
        if (!res.ok) throw new Error('Failed to load picks');
        const data: FPLManagerPicks = await res.json();
        setPicks(data);
        setBank((data.entry_history.bank / 10).toFixed(1));
      } catch { setPicks(null); } finally { setLoadingSquad(false); }
    }
    fetchPicks();
  }, [teamId]);

  const teamMap = useMemo(() => {
    if (!bootstrap) return new Map<number, FPLTeam>();
    return new Map(bootstrap.teams.map(t => [t.id, t]));
  }, [bootstrap]);

  const playerMap = useMemo(() => {
    if (!bootstrap) return new Map<number, FPLPlayer>();
    return new Map(bootstrap.elements.map(p => [p.id, p]));
  }, [bootstrap]);

  const nextEvent = useMemo(() => {
    if (!bootstrap) return null;
    return bootstrap.events.find(e => e.is_next) ?? null;
  }, [bootstrap]);

  const priceChanges = useMemo(() => {
    if (!bootstrap) return { risers: [] as PriceChange[], fallers: [] as PriceChange[] };
    return getPriceChangePredictions(bootstrap.elements, bootstrap.teams, 10);
  }, [bootstrap]);

  function handleSetTeamId() {
    const id = inputId.trim();
    if (!id || isNaN(Number(id))) return;
    localStorage.setItem('fpl-team-id', id);
    setTeamId(id);
    setHasGenerated(false);
    setSuggestions([]);
  }

  function handleGetSuggestions() {
    if (!bootstrap || !picks) return;
    const bankTenths = Math.round(parseFloat(bank) * 10);
    setSuggestions(getTransferSuggestions(picks.picks, bootstrap.elements, bootstrap.teams, fixtures, bootstrap.events, freeTransfers, bankTenths));
    setDifferentials(getDifferentials(bootstrap.elements, bootstrap.teams, fixtures, bootstrap.events, maxOwnership));
    setHasGenerated(true);
  }

  function getUpcomingFixtures(playerId: number, count = 3) {
    const player = playerMap.get(playerId);
    if (!player || !nextEvent) return [];
    const targetGWs = Array.from({ length: count }, (_, i) => nextEvent.id + i);
    return fixtures
      .filter(f => f.event !== null && targetGWs.includes(f.event!) && (f.team_h === player.team || f.team_a === player.team))
      .map(f => {
        const isHome = f.team_h === player.team;
        return { opponent: teamMap.get(isHome ? f.team_a : f.team_h)?.short_name ?? '???', isHome, difficulty: isHome ? f.team_h_difficulty : f.team_a_difficulty };
      });
  }

  if (loading) return <LoadingSpinner message="Loading FPL data..." />;
  if (error) return <EmptyState variant="error" title="Error" description={error} />;

  return (
    <div className="space-y-6">
      <PageHeader title="Transfer Hub" subtitle="Transfer suggestions based on form, fixtures, and value" />

      {/* Config */}
      <div className="card">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1">
            <label className="micro-label">Team ID</label>
            <div className="flex gap-2">
              <input type="number" placeholder="e.g. 1234567" value={inputId} onChange={e => setInputId(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSetTeamId()} className="input-field w-32" />
              <button onClick={handleSetTeamId} className="btn-secondary">Load</button>
            </div>
          </div>
          <div className="space-y-1">
            <label className="micro-label">Free Transfers</label>
            <select value={freeTransfers} onChange={e => setFreeTransfers(Number(e.target.value))} className="input-field w-20">
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="micro-label">Bank (m)</label>
            <input type="number" step="0.1" min="0" value={bank} onChange={e => setBank(e.target.value)} className="input-field w-24" />
          </div>
          <button onClick={handleGetSuggestions} disabled={!picks || loadingSquad} className="btn-primary disabled:opacity-50">
            {loadingSquad ? 'Loading squad...' : 'Get Suggestions'}
          </button>
          {teamId && picks && <span className="badge-green self-center">Squad loaded</span>}
        </div>
      </div>

      {/* Segmented control */}
      {hasGenerated && (
        <div className="segmented-control">
          {(['replacements', 'differentials', 'price-watch'] as Tab[]).map(tab => (
            <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>
              {tab === 'replacements' ? 'Replacements' : tab === 'differentials' ? 'Differentials' : 'Price Watch'}
            </button>
          ))}
        </div>
      )}

      {/* Replacements Tab */}
      {hasGenerated && activeTab === 'replacements' && (
        <div className="space-y-4">
          {suggestions.length === 0 ? (
            <EmptyState variant="no-results" title="No suggestions" description="Your squad may already be optimised." />
          ) : (
            suggestions.map((s, sIdx) => (
              <div key={sIdx} className="card">
                <div className="flex flex-col xl:flex-row gap-4 xl:gap-6 items-stretch">
                  {/* Out */}
                  <div className="xl:w-56 flex-shrink-0 rounded-md-design p-3 border" style={{ background: 'var(--semantic-red-50)', borderColor: 'var(--semantic-red-100)' }}>
                    <p className="micro-label mb-1" style={{ color: 'var(--semantic-red-600)' }}>Sell</p>
                    <p className="text-base-design font-semibold" style={{ color: 'var(--text-primary)' }}>{s.playerOut.web_name}</p>
                    <p className="text-xs-design mt-0.5" style={{ color: 'var(--text-secondary)' }}>{s.playerOutTeam.short_name} · {POSITION_MAP[s.playerOut.element_type]} · {'£'}{(s.playerOut.now_cost / 10).toFixed(1)}m</p>
                    <p className="text-xs-design mt-2" style={{ color: 'var(--semantic-red-600)' }}>{s.sellReason}</p>
                    <div className="flex gap-1 mt-2">
                      {getUpcomingFixtures(s.playerOut.id).map((f, fi) => <FDRBadge key={fi} difficulty={f.difficulty} compact />)}
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="hidden xl:flex items-center justify-center">
                    <ArrowLeftRight size={20} style={{ color: 'var(--text-tertiary)' }} />
                  </div>

                  {/* Buy options */}
                  <div className="flex-1 space-y-2">
                    {s.replacements.map((rep, rIdx) => {
                      const isTop = rIdx === 0;
                      return (
                        <div key={rep.player.id} className="rounded-md-design border p-3 transition-all duration-200" style={{
                          background: isTop ? 'var(--semantic-green-50)' : 'var(--surface-raised)',
                          borderColor: isTop ? 'var(--semantic-green-100)' : 'var(--border-subtle)',
                        }}>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <div className="sm:w-36 flex-shrink-0">
                              <div className="flex items-center gap-2">
                                {isTop && <span className="badge-green">Top Pick</span>}
                                <span className="text-sm-design font-semibold" style={{ color: 'var(--text-primary)' }}>{rep.player.web_name}</span>
                              </div>
                              <p className="text-xs-design mt-0.5" style={{ color: 'var(--text-secondary)' }}>{rep.team.short_name} · {'£'}{(rep.player.now_cost / 10).toFixed(1)}m</p>
                            </div>
                            <div className="flex gap-4 text-xs-design flex-shrink-0">
                              <div><span style={{ color: 'var(--text-tertiary)' }}>Form</span><p className="mono font-medium" style={{ color: 'var(--text-primary)' }}>{rep.player.form}</p></div>
                              <div><span style={{ color: 'var(--text-tertiary)' }}>PPG</span><p className="mono font-medium" style={{ color: 'var(--text-primary)' }}>{rep.player.points_per_game}</p></div>
                            </div>
                            <div className="flex flex-wrap gap-1 flex-1">
                              {rep.reasons.map((reason, ri) => <span key={ri} className="badge-blue">{reason}</span>)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Differentials Tab */}
      {hasGenerated && activeTab === 'differentials' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-sm-design" style={{ color: 'var(--text-secondary)' }}>Max Ownership:</label>
            <input type="range" min={1} max={25} value={maxOwnership}
              onChange={e => {
                const val = Number(e.target.value);
                setMaxOwnership(val);
                if (bootstrap) setDifferentials(getDifferentials(bootstrap.elements, bootstrap.teams, fixtures, bootstrap.events, val));
              }}
              className="w-32"
              style={{ accentColor: 'var(--semantic-blue-500)' }}
            />
            <span className="mono text-sm-design" style={{ color: 'var(--semantic-blue-600)' }}>{maxOwnership}%</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {differentials.map(diff => (
              <div key={diff.player.id} className="card-hover">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm-design font-semibold" style={{ color: 'var(--text-primary)' }}>{diff.player.web_name}</p>
                    <p className="text-xs-design mt-0.5" style={{ color: 'var(--text-secondary)' }}>{diff.team.short_name} · {POSITION_MAP[diff.player.element_type]}</p>
                  </div>
                  <span className="badge-blue">{diff.ownership}% owned</span>
                </div>
                <div className="flex gap-4 mt-3 text-xs-design">
                  <div><span style={{ color: 'var(--text-tertiary)' }}>Form</span><p className="mono" style={{ color: 'var(--text-primary)' }}>{diff.player.form}</p></div>
                  <div><span style={{ color: 'var(--text-tertiary)' }}>PPG</span><p className="mono" style={{ color: 'var(--text-primary)' }}>{diff.player.points_per_game}</p></div>
                  <div><span style={{ color: 'var(--text-tertiary)' }}>Price</span><p className="mono" style={{ color: 'var(--text-primary)' }}>{'£'}{(diff.player.now_cost / 10).toFixed(1)}m</p></div>
                  <div><span style={{ color: 'var(--text-tertiary)' }}>Score</span><p className="mono font-medium" style={{ color: 'var(--semantic-green-600)' }}>{diff.score.toFixed(1)}</p></div>
                </div>
                <p className="text-xs-design mt-3 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{diff.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Price Watch Tab */}
      {(hasGenerated && activeTab === 'price-watch' || !hasGenerated) && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <PricePanel title="Expected Risers" items={priceChanges.risers} direction="rise" />
          <PricePanel title="Expected Fallers" items={priceChanges.fallers} direction="fall" />
        </div>
      )}
    </div>
  );
}

function PricePanel({ title, items, direction }: { title: string; items: PriceChange[]; direction: 'rise' | 'fall' }) {
  const isRise = direction === 'rise';
  return (
    <div className="card">
      <h3 className="text-sm-design font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: isRise ? 'var(--semantic-green-500)' : 'var(--semantic-red-500)' }} />
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-sm-design" style={{ color: 'var(--text-tertiary)' }}>No data available.</p>
      ) : (
        <div className="space-y-2">
          {items.map(pc => (
            <div key={pc.player.id} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm-design font-medium truncate" style={{ color: 'var(--text-primary)' }}>{pc.player.web_name}</span>
                  <span className="text-xs-design" style={{ color: 'var(--text-tertiary)' }}>{pc.team.short_name}</span>
                  <span className="mono text-xs-design" style={{ color: 'var(--text-secondary)' }}>{'£'}{(pc.player.now_cost / 10).toFixed(1)}m</span>
                </div>
                <span className="mono text-xs-design font-medium" style={{ color: isRise ? 'var(--semantic-green-600)' : 'var(--semantic-red-600)' }}>
                  {isRise ? '+' : ''}{pc.netTransfers.toLocaleString()} net
                </span>
              </div>
              <div className="w-20 flex items-center gap-1.5">
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-sunken)' }}>
                  <div className="h-full rounded-full" style={{ width: `${pc.confidence}%`, background: isRise ? 'var(--semantic-green-500)' : 'var(--semantic-red-500)' }} />
                </div>
                <span className="mono text-[10px] w-7 text-right" style={{ color: 'var(--text-tertiary)' }}>{pc.confidence}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
