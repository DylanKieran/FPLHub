'use client';

import { useState, useEffect, useMemo } from 'react';
import StatCard from '@/components/StatCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import FDRBadge from '@/components/FDRBadge';
import PlayerPhoto from '@/components/PlayerPhoto';
import {
  getCaptainPicks, getFixtureOutlook, getPriceChangePredictions, getModelComparisons,
  getInjuryFeed, availabilityColor, isPreSeason, daysUntil,
  getNewSignings, getTemplatePicks, getOpeningRuns,
} from '@/lib/algorithms';
import { POSITION_MAP } from '@/types/fpl';
import type { FPLPlayer, FPLTeam, FPLEvent, FPLFixture, FPLBootstrap, FPLManager, FPLManagerHistory, FPLManagerPicks } from '@/types/fpl';
import type { CaptainPick, TeamFixtureRun, PriceChange, ModelComparison } from '@/lib/algorithms';
import { ArrowUpRight, Crown, Search } from 'lucide-react';

export default function DashboardPage() {
  const [bootstrap, setBootstrap] = useState<FPLBootstrap | null>(null);
  const [fixtures, setFixtures] = useState<FPLFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teamId, setTeamId] = useState('');
  const [savedTeamId, setSavedTeamId] = useState<string | null>(null);
  const [manager, setManager] = useState<FPLManager | null>(null);
  const [managerHistory, setManagerHistory] = useState<FPLManagerHistory | null>(null);
  const [managerPicks, setManagerPicks] = useState<FPLManagerPicks | null>(null);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('fpl-team-id') : null;
    if (stored) { setSavedTeamId(stored); setTeamId(stored); }
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        const [bsRes, fxRes] = await Promise.all([fetch('/api/fpl/bootstrap'), fetch('/api/fpl/fixtures')]);
        if (!bsRes.ok || !fxRes.ok) throw new Error('Failed to fetch FPL data');
        setBootstrap(await bsRes.json());
        setFixtures(await fxRes.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally { setLoading(false); }
    }
    fetchData();
  }, []);

  // Fetch manager data when team ID is set
  useEffect(() => {
    if (!savedTeamId) return;
    async function fetchManager() {
      try {
        const [mgrRes, histRes, picksRes] = await Promise.all([
          fetch(`/api/fpl/entry/${savedTeamId}`),
          fetch(`/api/fpl/entry/${savedTeamId}?type=history`),
          fetch(`/api/fpl/entry/${savedTeamId}?type=picks`),
        ]);
        if (mgrRes.ok) setManager(await mgrRes.json());
        if (histRes.ok) setManagerHistory(await histRes.json());
        if (picksRes.ok) setManagerPicks(await picksRes.json());
      } catch {}
    }
    fetchManager();
  }, [savedTeamId]);

  const currentEvent = useMemo(() => bootstrap?.events.find(e => e.is_current) ?? null, [bootstrap]);
  const nextEvent = useMemo(() => bootstrap?.events.find(e => e.is_next) ?? null, [bootstrap]);
  const preSeason = useMemo(() => (bootstrap ? isPreSeason(bootstrap.events) : false), [bootstrap]);
  const gwLabel = currentEvent?.id ?? nextEvent?.id ?? null;

  // ── Pre-season content (only computed while it's relevant) ──
  const newSignings = useMemo(() => {
    if (!bootstrap || !preSeason) return [];
    return getNewSignings(bootstrap.elements, bootstrap.teams, 6);
  }, [bootstrap, preSeason]);

  const templatePicks = useMemo(() => {
    if (!bootstrap || !preSeason) return null;
    return getTemplatePicks(bootstrap.elements, bootstrap.teams, 3);
  }, [bootstrap, preSeason]);

  const openingRuns = useMemo(() => {
    if (!bootstrap || !fixtures.length || !preSeason) return [];
    return getOpeningRuns(bootstrap.teams, fixtures, 5);
  }, [bootstrap, fixtures, preSeason]);

  const captainPicks = useMemo<CaptainPick[]>(() => {
    if (!bootstrap || !fixtures.length) return [];
    return getCaptainPicks(bootstrap.elements, bootstrap.teams, fixtures, bootstrap.events, 6);
  }, [bootstrap, fixtures]);

  const fixtureOutlook = useMemo<TeamFixtureRun[]>(() => {
    if (!bootstrap || !fixtures.length) return [];
    return getFixtureOutlook(bootstrap.teams, fixtures, bootstrap.events, 6);
  }, [bootstrap, fixtures]);

  const priceChanges = useMemo(() => {
    if (!bootstrap) return { risers: [] as PriceChange[], fallers: [] as PriceChange[] };
    return getPriceChangePredictions(bootstrap.elements, bootstrap.teams, 5);
  }, [bootstrap]);

  // Recent availability news, newest first.
  const injuryFeed = useMemo(() => {
    if (!bootstrap) return [];
    return getInjuryFeed(bootstrap.elements, bootstrap.teams, 6);
  }, [bootstrap]);

  // Where our model most disagrees with FPL's own ep_next projection.
  const modelComparisons = useMemo<ModelComparison[]>(() => {
    if (!bootstrap || !fixtures.length) return [];
    return getModelComparisons(bootstrap.elements, bootstrap.teams, fixtures, bootstrap.events, {
      minOwnership: 2,
      limit: 150,
    });
  }, [bootstrap, fixtures]);

  const deadlineStr = useMemo(() => {
    const ev = nextEvent ?? currentEvent;
    if (!ev) return null;
    const d = new Date(ev.deadline_time);
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }, [nextEvent, currentEvent]);

  // Derive manager stats from history
  const mgrStats = useMemo(() => {
    if (!manager || !managerHistory) return null;
    const current = managerHistory.current;
    const latestGW = current[current.length - 1];
    if (!latestGW) return null;
    const prevGW = current.length >= 2 ? current[current.length - 2] : null;
    const rankChange = prevGW ? prevGW.overall_rank - latestGW.overall_rank : 0;
    const totalManagers = bootstrap?.total_players ?? 0;
    const pctRank = totalManagers > 0 ? ((1 - latestGW.overall_rank / totalManagers) * 100) : 0;
    const avgPoints = current.length > 0 ? latestGW.total_points / current.length : 0;
    const gwAvg = bootstrap?.events.find(e => e.id === latestGW.event)?.average_entry_score ?? 0;
    const pointsDelta = latestGW.points - gwAvg;
    const valueTotal = latestGW.value + latestGW.bank;
    const startValue = current[0]?.value ?? 1000;
    const valueDelta = valueTotal - startValue;

    return {
      overallRank: latestGW.overall_rank,
      rankChange,
      gwPoints: latestGW.points,
      gwAvg,
      pointsDelta,
      totalPoints: latestGW.total_points,
      gwCount: current.length,
      avgPoints,
      pctRank,
      squadValue: valueTotal,
      itb: latestGW.bank,
      valueDelta,
      transfers: latestGW.event_transfers,
      transferCost: latestGW.event_transfers_cost,
    };
  }, [manager, managerHistory, bootstrap]);

  function handleConnectTeam() {
    const id = teamId.trim();
    if (!id || isNaN(Number(id))) return;
    localStorage.setItem('fpl-team-id', id);
    setSavedTeamId(id);
  }

  function getMaxCaptainScore(): number {
    return captainPicks.length ? Math.max(...captainPicks.map(p => p.score)) : 1;
  }

  if (loading) return <LoadingSpinner message="Loading FPL data..." />;
  if (error) return <EmptyState variant="error" title="Error loading data" description={error} action={<button onClick={() => window.location.reload()} className="btn-primary">Retry</button>} />;

  const heroPick = captainPicks[0] ?? null;
  const altPicks = captainPicks.slice(1);
  const maxScore = getMaxCaptainScore();

  // GW column headers for FDR grid
  const gwHeaders = fixtureOutlook.length > 0
    ? [...new Set(fixtureOutlook[0]?.fixtures.map(f => f.event))].sort((a, b) => a - b)
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={gwLabel ? `Gameweek ${gwLabel}` : 'Dashboard'}
        subtitle={
          manager
            ? `${manager.name} · ID ${manager.id}`
            : preSeason
              ? `Pre-season — GW1 deadline: ${deadlineStr ?? ''}`
              : deadlineStr
                ? `Next deadline: ${deadlineStr}`
                : undefined
        }
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
              <input
                type="text"
                placeholder="Search players, teams, fixtures"
                className="input-field w-64 pl-8"
                readOnly
              />
            </div>
            {!savedTeamId ? (
              <div className="flex gap-2">
                <input type="number" placeholder="Team ID" value={teamId} onChange={e => setTeamId(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleConnectTeam()} className="input-field w-28" />
                <button onClick={handleConnectTeam} className="btn-primary">Connect</button>
              </div>
            ) : (
              <button onClick={() => { setSavedTeamId(null); setManager(null); setManagerHistory(null); setManagerPicks(null); localStorage.removeItem('fpl-team-id'); }} className="btn-secondary">Switch team</button>
            )}
          </div>
        }
      />

      {/* 4-up stat cards — personalised when manager data available */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {mgrStats ? (
          <>
            <StatCard
              label="Overall rank"
              value={mgrStats.overallRank.toLocaleString()}
              topRight={mgrStats.rankChange > 0 ? '↗' : mgrStats.rankChange < 0 ? '↘' : undefined}
              subValue={mgrStats.rankChange !== 0 ? `${Math.abs(mgrStats.rankChange).toLocaleString()} places this GW` : undefined}
              trend={mgrStats.rankChange > 0 ? 'up' : mgrStats.rankChange < 0 ? 'down' : undefined}
              footnote={`Updated ${deadlineStr ? 'recently' : ''}`}
            />
            <StatCard
              label={`GW${mgrStats.gwCount > 0 ? (managerHistory?.current[managerHistory.current.length - 1]?.event ?? '') : ''} points`}
              value={mgrStats.gwPoints.toString()}
              topRight={`avg ${mgrStats.gwAvg}`}
              subValue={mgrStats.pointsDelta !== 0 ? `${mgrStats.pointsDelta > 0 ? '+' : ''}${mgrStats.pointsDelta} vs gameweek average` : undefined}
              trend={mgrStats.pointsDelta > 0 ? 'up' : mgrStats.pointsDelta < 0 ? 'down' : undefined}
              footnote={`${mgrStats.transfers} transfer${mgrStats.transfers !== 1 ? 's' : ''} · ${mgrStats.transferCost} pts hit`}
            />
            <StatCard
              label="Squad value"
              value={`£${(mgrStats.squadValue / 10).toFixed(1)}m`}
              topRight={`ITB £${(mgrStats.itb / 10).toFixed(1)}m`}
              subValue={`${mgrStats.valueDelta >= 0 ? '+' : ''}£${(mgrStats.valueDelta / 10).toFixed(1)}m since GW1`}
              trend={mgrStats.valueDelta >= 0 ? 'up' : 'down'}
            />
            <StatCard
              label="Season total"
              value={mgrStats.totalPoints.toLocaleString()}
              topRight={`${mgrStats.gwCount} GWs`}
              subValue={`${mgrStats.avgPoints.toFixed(1)} points per gameweek`}
              footnote={mgrStats.pctRank > 0 ? `Top ${(100 - mgrStats.pctRank).toFixed(0)}% of all managers` : undefined}
            />
          </>
        ) : preSeason ? (
          <>
            <StatCard
              label="GW1 deadline"
              value={nextEvent ? `${daysUntil(nextEvent.deadline_time)}d` : '--'}
              subValue={deadlineStr ?? undefined}
              footnote="Squad must be set before kick-off"
            />
            <StatCard
              label="Managers signed up"
              value={(bootstrap?.total_players ?? 0).toLocaleString()}
              footnote="Growing daily until GW1"
            />
            <StatCard
              label="Budget"
              value="£100.0m"
              footnote="15 players · max 3 per club"
            />
            <StatCard
              label="Players priced"
              value={(bootstrap?.elements.length ?? 0).toLocaleString()}
              topRight={openingRuns.length > 0 ? `${openingRuns.length} teams` : undefined}
              footnote="Prices locked until the season starts"
            />
          </>
        ) : (
          <>
            <StatCard label="Total Managers" value={(bootstrap?.total_players ?? 0).toLocaleString()} />
            <StatCard label="Gameweek" value={gwLabel ? `GW${gwLabel}` : '--'} />
            <StatCard
              label="Most Captained"
              value={(() => {
                const ref = currentEvent ?? bootstrap?.events.find(e => e.is_previous);
                if (!ref?.most_captained) return '--';
                const p = bootstrap?.elements.find(el => el.id === ref.most_captained);
                return p ? p.web_name : '--';
              })()}
            />
            <StatCard
              label="Top Scorer"
              value={(() => {
                const ref = currentEvent ?? bootstrap?.events.find(e => e.is_previous);
                if (!ref?.top_element_info) return '--';
                const p = bootstrap?.elements.find(el => el.id === ref.top_element_info!.id);
                return p?.web_name ?? '--';
              })()}
              subValue={(() => {
                const ref = currentEvent ?? bootstrap?.events.find(e => e.is_previous);
                return ref?.top_element_info ? `${ref.top_element_info.points} pts` : undefined;
              })()}
              trend="up"
            />
          </>
        )}
      </div>

      {/* ── Pre-season planning ── */}
      {preSeason && (
        <div className="space-y-6">
          {/* Template picks + new signings */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <div className="xl:col-span-7 space-y-4">
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg-design font-semibold" style={{ color: 'var(--text-primary)' }}>Template watch</h2>
                <span className="text-xs-design" style={{ color: 'var(--text-tertiary)' }}>Most-selected by position</span>
              </div>
              <div className="card">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                  {([1, 2, 3, 4] as const).map(pos => (
                    <div key={pos}>
                      <p className="micro-label mb-2.5">{POSITION_MAP[pos]}</p>
                      <div className="space-y-2.5">
                        {(templatePicks?.[pos] ?? []).map(tp => (
                          <div key={tp.player.id} className="flex items-center gap-2">
                            <PlayerPhoto player={tp.player} size={26} />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs-design font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                                {tp.player.web_name}
                              </p>
                              <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                                {tp.team.short_name} · £{(tp.player.now_cost / 10).toFixed(1)}m
                              </p>
                            </div>
                            <span className="mono text-[10px] font-semibold flex-shrink-0" style={{ color: 'var(--semantic-blue-600)' }}>
                              {tp.ownership.toFixed(0)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="xl:col-span-5 space-y-4">
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg-design font-semibold" style={{ color: 'var(--text-primary)' }}>New signings</h2>
                <span className="text-xs-design" style={{ color: 'var(--text-tertiary)' }}>No FPL history yet</span>
              </div>
              <div className="card">
                {newSignings.length === 0 ? (
                  <p className="text-sm-design" style={{ color: 'var(--text-tertiary)' }}>No recent transfers detected.</p>
                ) : (
                  <div className="space-y-3">
                    {newSignings.map(s => (
                      <div key={s.player.id} className="flex items-center gap-2.5">
                        <PlayerPhoto player={s.player} size={30} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm-design font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                            {s.player.web_name}
                          </p>
                          <p className="text-xs-design" style={{ color: 'var(--text-tertiary)' }}>
                            {s.team.name} · {POSITION_MAP[s.player.element_type]}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="mono text-sm-design font-semibold" style={{ color: 'var(--semantic-blue-600)' }}>
                            £{(s.player.now_cost / 10).toFixed(1)}m
                          </p>
                          <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                            {s.joined.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Opening fixtures */}
          <div className="space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg-design font-semibold" style={{ color: 'var(--text-primary)' }}>Best opening fixtures</h2>
              <span className="text-xs-design" style={{ color: 'var(--text-tertiary)' }}>GW1–5 average difficulty</span>
            </div>
            <div className="card">
              <div className="space-y-2">
                {openingRuns.slice(0, 8).map(run => (
                  <div key={run.team.id} className="flex items-center gap-3">
                    <span className="text-sm-design font-semibold w-12 flex-shrink-0" style={{ color: 'var(--text-primary)' }}>
                      {run.team.short_name}
                    </span>
                    <div className="flex gap-1 flex-1">
                      {run.fixtures.map(f => {
                        const s = getFDRStyle(f.difficulty);
                        return (
                          <div
                            key={f.event}
                            className="flex flex-col items-center justify-center rounded-sm-design py-1"
                            style={{ background: s.bg, color: s.text, minWidth: '46px' }}
                            title={`GW${f.event}: ${f.opponent} (${f.isHome ? 'H' : 'A'})`}
                          >
                            <span className="text-[10px] font-bold">{f.opponent}</span>
                            <span className="text-[8px] opacity-75">{f.isHome ? 'H' : 'A'}·{f.difficulty}</span>
                          </div>
                        );
                      })}
                    </div>
                    <span className="mono text-sm-design font-bold w-10 text-right flex-shrink-0" style={{ color: getFDRStyle(Math.round(run.avgDifficulty)).text }}>
                      {run.avgDifficulty.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Captain shortlist + Price watch — 7:5 split like reference.
          Pre-season the price panel is omitted (transfer counts are zero and
          prices are locked), so the shortlist takes the full width. */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Captain shortlist column */}
        <div className={`${preSeason ? 'xl:col-span-12' : 'xl:col-span-7'} space-y-4`}>
          {/* Section header — outside the cards */}
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg-design font-semibold" style={{ color: 'var(--text-primary)' }}>
              {preSeason ? 'GW1 captain shortlist' : 'Captain shortlist'}
            </h2>
            <span className="text-xs-design" style={{ color: 'var(--text-tertiary)' }}>
              {preSeason ? 'Based on last season — no current form data yet' : 'Weighted on form, fixture, xG and minutes'}
            </span>
          </div>

          {/* Hero pick card */}
          {heroPick && (
            <div className="card" style={{ borderLeft: '4px solid var(--semantic-green-500)' }}>
              <div className="flex items-center gap-1.5 mb-4">
                <Crown size={14} style={{ color: 'var(--semantic-amber-500)' }} fill="var(--semantic-amber-500)" />
                <span className="micro-label" style={{ color: 'var(--semantic-amber-500)', letterSpacing: '0.1em' }}>
                  CAPTAIN PICK — GW{gwLabel}
                </span>
              </div>

              {/* Photo + name/club/fixtures + score */}
              <div className="flex items-start gap-4">
                <PlayerPhoto player={heroPick.player} size={80} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-2xl-design font-semibold" style={{ color: 'var(--text-primary)' }}>{heroPick.player.web_name}</p>
                      <p className="text-sm-design mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        {heroPick.team.name} · {POSITION_MAP[heroPick.player.element_type]} · £{(heroPick.player.now_cost / 10).toFixed(1)}m
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="mono text-3xl-design font-bold" style={{ color: 'var(--semantic-green-600)' }}>{heroPick.score.toFixed(1)}</p>
                      <p className="micro-label">xPTS</p>
                    </div>
                  </div>

                  {/* FDR badges — directly under name/club, left-aligned, bigger */}
                  <div className="flex gap-2.5 mt-3">
                    {heroPick.fixtures.map((f, fi) => {
                      const s = getFDRStyle(f.difficulty);
                      return (
                        <div key={fi} className="flex flex-col items-center justify-center rounded-md-design w-11 h-11" style={{ background: s.bg, color: s.text }}>
                          <span className="text-sm-design font-bold leading-none">{f.difficulty}</span>
                          <span className="text-[9px] leading-none mt-1 opacity-80">{f.opponent} ({f.isHome ? 'H' : 'A'})</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Stats row — full width */}
              <div className="flex gap-8 mt-4 mb-4 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                {[
                  { label: 'FORM', value: heroPick.player.form },
                  { label: 'XGI/90', value: (heroPick.player.expected_goal_involvements_per_90 ?? 0).toFixed(2) },
                  { label: 'PPG', value: heroPick.player.points_per_game },
                  { label: 'OWNED', value: `${heroPick.player.selected_by_percent}%` },
                ].map(stat => (
                  <div key={stat.label}>
                    <p className="micro-label" style={{ fontSize: '9px' }}>{stat.label}</p>
                    <p className="mono text-sm-design font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Reasoning */}
              <p className="text-sm-design leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{heroPick.reasoning}</p>
            </div>
          )}

          {/* Alternatives card — separate from hero */}
          {altPicks.length > 0 && (
            <div className="card !py-0">
              <div className="divide-y" style={{ borderColor: 'var(--row-divider)' }}>
                {altPicks.map((pick, idx) => {
                  const pct = (pick.score / maxScore) * 100;
                  return (
                    <div key={pick.player.id} className="flex items-center gap-3 py-4">
                      <span className="mono text-sm-design w-5 text-right flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>{idx + 2}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-base-design" style={{ color: 'var(--text-primary)' }}>{pick.player.web_name}</p>
                        <p className="text-xs-design mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                          {pick.team.short_name} · {POSITION_MAP[pick.player.element_type]} · £{(pick.player.now_cost / 10).toFixed(1)}m
                        </p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-sunken)' }}>
                          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: 'var(--semantic-blue-500)' }} />
                        </div>
                        <span className="mono text-sm-design w-8 text-right" style={{ color: 'var(--text-secondary)' }}>{pick.score.toFixed(1)}</span>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {pick.fixtures.map((f, fi) => {
                          const s = getFDRStyle(f.difficulty);
                          return (
                            <div key={fi} className="flex flex-col items-center justify-center rounded-sm-design w-9 h-9 text-center" style={{ background: s.bg, color: s.text }}>
                              <span className="text-[10px] font-semibold leading-none">{f.opponent.slice(0, 3)}</span>
                              <span className="text-[8px] leading-none mt-0.5 opacity-70">{f.isHome ? 'H' : 'A'}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Price watch column — omitted pre-season, when prices are locked */}
        {!preSeason && (
        <div className="xl:col-span-5 space-y-4">
          {/* Section header — outside the card, matches Captain shortlist treatment */}
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg-design font-semibold" style={{ color: 'var(--text-primary)' }}>Price watch</h2>
            <NextPriceChange />
          </div>

          <div className="card">
            {/* Risers */}
            <PriceSection label="LIKELY RISERS" players={priceChanges.risers} direction="rise" />

            {/* Divider */}
            <div className="border-t my-4" style={{ borderColor: 'var(--border-subtle)' }} />

            {/* Fallers */}
            <PriceSection label="LIKELY FALLERS" players={priceChanges.fallers} direction="fall" />
          </div>

          {/* Availability news — newest first, from the API's news feed */}
          {injuryFeed.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-3.5">
                <h3 className="text-base-design font-semibold" style={{ color: 'var(--text-primary)' }}>Availability news</h3>
                <a href="/players" className="text-xs-design font-medium inline-flex items-center gap-1" style={{ color: 'var(--semantic-blue-600)' }}>
                  All players <ArrowUpRight size={10} />
                </a>
              </div>
              <div className="space-y-3">
                {injuryFeed.map(entry => (
                  <div key={entry.player.id} className="flex items-start gap-2.5">
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
                      style={{ background: availabilityColor(entry.availability.level) }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm-design font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {entry.player.web_name}
                        </span>
                        <span className="text-xs-design" style={{ color: 'var(--text-tertiary)' }}>
                          {entry.team.short_name}
                        </span>
                        <span className="text-[10px] font-medium" style={{ color: availabilityColor(entry.availability.level) }}>
                          {entry.availability.label}
                        </span>
                      </div>
                      <p className="text-xs-design mt-0.5 leading-snug" style={{ color: 'var(--text-secondary)' }}>
                        {entry.availability.note}
                      </p>
                    </div>
                    {entry.newsAdded && (
                      <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                        {entry.newsAdded.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        )}
      </div>

      {/* FDR Grid — all 20 teams */}
      <div className="space-y-4">
        {/* Section header — outside the card, matches Captain shortlist / Price watch treatment */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg-design font-semibold" style={{ color: 'var(--text-primary)' }}>
            Fixture difficulty — next {gwHeaders.length}
          </h2>
          <div className="flex items-center gap-2 text-xs-design" style={{ color: 'var(--text-tertiary)' }}>
            <span>Easier</span>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map(d => {
                const s = getFDRStyle(d);
                return <div key={d} className="w-3 h-3 rounded-sm" style={{ background: s.bg }} />;
              })}
            </div>
            <span>Harder</span>
          </div>
        </div>

        <div className="card">
          {fixtureOutlook.length === 0 ? (
            <p className="text-sm-design" style={{ color: 'var(--text-tertiary)' }}>No fixture data available yet.</p>
          ) : (
            <div className="overflow-x-auto -mx-5 -mt-5">
              <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-sunken)' }}>
                    <th className="text-left micro-label py-2.5 pl-5 w-16" style={{ borderTopLeftRadius: '10px' }}>TEAM</th>
                    {gwHeaders.map(gw => (
                      <th key={gw} className="micro-label py-2.5 text-center" style={{ minWidth: '84px' }}>GW{gw}</th>
                    ))}
                    <th className="micro-label py-2.5 pr-5 text-right w-14" style={{ borderTopRightRadius: '10px' }}>AVG</th>
                  </tr>
                </thead>
                <tbody>
                  {fixtureOutlook.map((run, idx) => (
                    <FixtureRunRow key={run.team.id} run={run} gwHeaders={gwHeaders} index={idx} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Model disagreements — our projection vs FPL's own ep_next */}
      {modelComparisons.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg-design font-semibold" style={{ color: 'var(--text-primary)' }}>
              Where we differ from FPL
            </h2>
            <span className="text-xs-design" style={{ color: 'var(--text-tertiary)' }}>
              Our GW{gwLabel} projection vs FPL&apos;s own
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DisagreementPanel
              title="We're higher"
              subtitle="Our model rates these above FPL's projection"
              rows={modelComparisons.filter(c => c.direction === 'bullish').slice(0, 5)}
            />
            <DisagreementPanel
              title="We're lower"
              subtitle="Our model rates these below FPL's projection"
              rows={modelComparisons.filter(c => c.direction === 'bearish').slice(0, 5)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ────────────────── Sub-components ────────────────── */

/** Side-by-side comparison of our xPts against FPL's published ep_next. */
function DisagreementPanel({ title, subtitle, rows }: { title: string; subtitle: string; rows: ModelComparison[] }) {
  const isBullish = rows[0]?.direction === 'bullish';
  const accent = isBullish ? 'var(--semantic-green-600)' : 'var(--semantic-red-600)';

  return (
    <div className="card">
      <div className="mb-4">
        <h3 className="text-base-design font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        <p className="text-xs-design mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{subtitle}</p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm-design" style={{ color: 'var(--text-tertiary)' }}>No notable differences.</p>
      ) : (
        <div className="space-y-3">
          {rows.map(row => (
            <div key={row.player.id} className="flex items-center gap-3">
              <PlayerPhoto player={row.player} size={32} />
              <div className="flex-1 min-w-0">
                <p className="text-sm-design font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                  {row.player.web_name}
                </p>
                <p className="text-xs-design" style={{ color: 'var(--text-tertiary)' }}>
                  {row.team.short_name} · {POSITION_MAP[row.player.element_type]}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 text-right">
                <div>
                  <p className="mono text-sm-design font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {row.ourXPts.toFixed(1)}
                  </p>
                  <p className="text-[9px]" style={{ color: 'var(--text-tertiary)' }}>OURS</p>
                </div>
                <div>
                  <p className="mono text-sm-design" style={{ color: 'var(--text-secondary)' }}>
                    {row.fplEpNext.toFixed(1)}
                  </p>
                  <p className="text-[9px]" style={{ color: 'var(--text-tertiary)' }}>FPL</p>
                </div>
                <span className="mono text-sm-design font-bold w-12" style={{ color: accent }}>
                  {row.delta >= 0 ? '+' : ''}{row.delta.toFixed(1)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PriceSection({ label, players, direction }: { label: string; players: PriceChange[]; direction: 'rise' | 'fall' }) {
  const isRise = direction === 'rise';
  return (
    <div>
      <p className="flex items-center gap-1.5 mb-3.5">
        <span className="text-xs-design" style={{ color: isRise ? 'var(--semantic-green-600)' : 'var(--semantic-red-600)' }}>
          {isRise ? '▲' : '▼'}
        </span>
        <span className="micro-label" style={{ color: isRise ? 'var(--semantic-green-600)' : 'var(--semantic-red-600)', letterSpacing: '0.09em' }}>{label}</span>
      </p>
      {players.length === 0 ? (
        <p className="text-sm-design" style={{ color: 'var(--text-tertiary)' }}>No data available.</p>
      ) : (
        <div className="space-y-3.5">
          {players.slice(0, 5).map(pc => (
            <div key={pc.player.id} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm-design font-semibold" style={{ color: 'var(--text-primary)' }}>{pc.player.web_name}</p>
                <p className="text-xs-design mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                  {pc.team.short_name} · £{(pc.player.now_cost / 10).toFixed(1)}m
                </p>
              </div>
              <span className="mono text-sm-design font-semibold flex-shrink-0" style={{ color: isRise ? 'var(--semantic-green-600)' : 'var(--semantic-red-600)' }}>
                {isRise ? '+' : ''}{pc.netTransfers.toLocaleString()}
              </span>
              <div className="w-24 h-1.5 rounded-full overflow-hidden flex-shrink-0" style={{ background: 'var(--surface-sunken)' }}>
                <div className="h-full rounded-full" style={{ width: `${pc.confidence}%`, background: isRise ? 'var(--semantic-green-500)' : 'var(--semantic-red-500)' }} />
              </div>
              <span className="mono text-xs-design w-8 text-right flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>{pc.confidence}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FixtureRunRow({ run, gwHeaders, index }: { run: TeamFixtureRun; gwHeaders: number[]; index: number }) {
  const avgStyle = getFDRStyle(Math.round(run.avgDifficulty));
  return (
    <tr style={{ background: index % 2 === 1 ? 'var(--row-tint)' : 'transparent', borderBottom: '1px solid var(--row-divider)' }}>
      <td className="py-2.5 pl-5">
        <span className="text-sm-design font-semibold" style={{ color: 'var(--text-primary)' }}>{run.team.short_name}</span>
      </td>
      {gwHeaders.map(gw => {
        const gwFixtures = run.fixtures.filter(f => f.event === gw);
        return (
          <td key={gw} className="py-1.5 text-center">
            <div className="flex justify-center gap-1">
              {gwFixtures.length > 0 ? gwFixtures.map((f, i) => {
                const style = getFDRStyle(f.difficulty);
                return (
                  <div
                    key={i}
                    className="inline-flex flex-col items-center justify-center rounded-md-design leading-tight"
                    style={{ background: style.bg, color: style.text, minWidth: '58px', padding: '4px 6px' }}
                    title={`GW${gw}: ${f.opponent} (${f.isHome ? 'H' : 'A'}) - FDR ${f.difficulty}`}
                  >
                    <span className="text-[11px] font-bold">{f.opponent.slice(0, 3)}</span>
                    <span className="text-[9px] opacity-75 mt-0.5">{f.isHome ? 'H' : 'A'}-{f.difficulty}</span>
                  </div>
                );
              }) : <span className="text-xs-design" style={{ color: 'var(--text-tertiary)' }}>-</span>}
            </div>
          </td>
        );
      })}
      <td className="py-2.5 pr-5 text-right">
        <span className="mono text-sm-design font-bold" style={{ color: avgStyle.text }}>
          {run.avgDifficulty.toFixed(2)}
        </span>
      </td>
    </tr>
  );
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

/**
 * Countdown to the next FPL price update.
 * For 2026/27 the Premier League states prices change daily at 00:00 UK time.
 * Computed after mount so the server and client markup agree, and refreshed
 * each minute so it doesn't go stale on a long-lived tab.
 */
function NextPriceChange() {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    function compute() {
      // Current time in the UK, regardless of the viewer's own timezone.
      const ukNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/London' }));
      const hours = 23 - ukNow.getHours();
      const mins = 59 - ukNow.getMinutes();
      setLabel(hours < 1 ? `Next change in ${mins}m` : `Next change in ${hours}h ${mins}m`);
    }
    compute();
    const id = setInterval(compute, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <span
      className="text-xs-design"
      style={{ color: 'var(--text-tertiary)' }}
      title="FPL updates player prices daily at 00:00 UK time"
    >
      {label ?? 'Daily at 00:00 UK'}
    </span>
  );
}
