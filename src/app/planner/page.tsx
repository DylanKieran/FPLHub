'use client';

import { useState, useEffect, useMemo } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import { TrendingUp, TrendingDown, Shuffle } from 'lucide-react';
import { buildFixturePlanner, getFixtureSwings, getRotationPairs } from '@/lib/algorithms';
import type { FPLFixture, FPLBootstrap } from '@/types/fpl';
import type { PlannerRow, FixtureSwing, RotationPair } from '@/lib/algorithms';

const HORIZONS = [4, 6, 8, 10];

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

export default function PlannerPage() {
  const [bootstrap, setBootstrap] = useState<FPLBootstrap | null>(null);
  const [fixtures, setFixtures] = useState<FPLFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [horizon, setHorizon] = useState(6);

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

  const startEvent = useMemo(() => {
    const next = bootstrap?.events.find(e => e.is_next);
    const current = bootstrap?.events.find(e => e.is_current);
    return next?.id ?? current?.id ?? 1;
  }, [bootstrap]);

  const gwHeaders = useMemo(
    () => Array.from({ length: horizon }, (_, i) => startEvent + i).filter(gw => gw <= 38),
    [startEvent, horizon]
  );

  const planner = useMemo<PlannerRow[]>(() => {
    if (!bootstrap || !fixtures.length) return [];
    return buildFixturePlanner(bootstrap.teams, fixtures, startEvent, horizon);
  }, [bootstrap, fixtures, startEvent, horizon]);

  const swings = useMemo<FixtureSwing[]>(() => {
    if (!bootstrap || !fixtures.length) return [];
    return getFixtureSwings(bootstrap.teams, fixtures, startEvent, Math.max(3, Math.floor(horizon / 2)));
  }, [bootstrap, fixtures, startEvent, horizon]);

  const rotationPairs = useMemo<RotationPair[]>(() => {
    if (!bootstrap || !fixtures.length) return [];
    return getRotationPairs(bootstrap.teams, fixtures, startEvent, horizon, 6);
  }, [bootstrap, fixtures, startEvent, horizon]);

  if (loading) return <LoadingSpinner message="Loading fixtures..." />;
  if (error) return <EmptyState variant="error" title="Error loading data" description={error} />;

  const improving = swings.filter(s => s.direction === 'improving').slice(0, 5);
  const worsening = swings.filter(s => s.direction === 'worsening').slice(0, 5);
  const windowSize = Math.max(3, Math.floor(horizon / 2));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fixture Planner"
        subtitle={`GW${gwHeaders[0]}–${gwHeaders[gwHeaders.length - 1]} · plan transfers around fixture swings`}
        actions={
          <div className="segmented-control">
            {HORIZONS.map(h => (
              <button key={h} onClick={() => setHorizon(h)} className={horizon === h ? 'active' : ''}>
                {h} GW
              </button>
            ))}
          </div>
        }
      />

      {/* Fixture swings */}
      {(improving.length > 0 || worsening.length > 0) && (
        <div className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg-design font-semibold" style={{ color: 'var(--text-primary)' }}>Fixture swings</h2>
            <span className="text-xs-design" style={{ color: 'var(--text-tertiary)' }}>
              Next {windowSize} GW vs the {windowSize} after
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SwingPanel
              title="Fixtures improving"
              subtitle="Buy before the run turns kind"
              icon={<TrendingUp size={15} style={{ color: 'var(--semantic-green-600)' }} />}
              rows={improving}
            />
            <SwingPanel
              title="Fixtures worsening"
              subtitle="Consider moving on before the run bites"
              icon={<TrendingDown size={15} style={{ color: 'var(--semantic-red-600)' }} />}
              rows={worsening}
            />
          </div>
        </div>
      )}

      {/* Rotation pairs */}
      {rotationPairs.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg-design font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Shuffle size={16} style={{ color: 'var(--semantic-blue-600)' }} />
              Rotation pairs
            </h2>
            <span className="text-xs-design" style={{ color: 'var(--text-tertiary)' }}>
              Play whichever has the kinder fixture
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {rotationPairs.map(pair => (
              <div key={`${pair.teamA.id}-${pair.teamB.id}`} className="card">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-base-design font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {pair.teamA.short_name} <span style={{ color: 'var(--text-tertiary)' }}>+</span> {pair.teamB.short_name}
                  </p>
                  <div className="text-right">
                    <p className="mono text-base-design font-bold" style={{ color: 'var(--semantic-green-600)' }}>
                      {pair.combinedAvg.toFixed(2)}
                    </p>
                    <p className="micro-label" style={{ fontSize: '9px' }}>AVG FDR</p>
                  </div>
                </div>
                <div className="flex gap-1 mb-2">
                  {pair.weeks.map(w => {
                    const s = getFDRStyle(w.difficulty);
                    const blank = w.pick === 'none';
                    return (
                      <div
                        key={w.event}
                        className="flex-1 rounded-sm-design py-1.5 text-center"
                        style={{
                          background: blank ? 'var(--surface-sunken)' : s.bg,
                          color: blank ? 'var(--text-tertiary)' : s.text,
                        }}
                        title={`GW${w.event}: ${blank ? 'blank' : `play ${w.pick === 'A' ? pair.teamA.short_name : pair.teamB.short_name} (FDR ${w.difficulty})`}`}
                      >
                        <p className="text-[9px] opacity-70">GW{w.event}</p>
                        <p className="text-[10px] font-bold">
                          {blank ? '—' : (w.pick === 'A' ? pair.teamA.short_name : pair.teamB.short_name)}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs-design" style={{ color: 'var(--text-tertiary)' }}>
                  {pair.improvement.toFixed(2)} better than holding{' '}
                  {pair.teamA.short_name} or {pair.teamB.short_name} alone
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full grid */}
      <div className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg-design font-semibold" style={{ color: 'var(--text-primary)' }}>
            All teams · next {gwHeaders.length}
          </h2>
          <div className="flex items-center gap-2 text-xs-design" style={{ color: 'var(--text-tertiary)' }}>
            <span>Easier</span>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map(d => (
                <div key={d} className="w-3 h-3 rounded-sm" style={{ background: getFDRStyle(d).bg }} />
              ))}
            </div>
            <span>Harder</span>
          </div>
        </div>

        <div className="card">
          {planner.length === 0 ? (
            <p className="text-sm-design" style={{ color: 'var(--text-tertiary)' }}>No fixture data available.</p>
          ) : (
            <div className="overflow-x-auto -mx-5 -mt-5">
              <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-sunken)' }}>
                    <th className="text-left micro-label py-2.5 pl-5 w-16" style={{ borderTopLeftRadius: '10px' }}>TEAM</th>
                    {gwHeaders.map(gw => (
                      <th key={gw} className="micro-label py-2.5 text-center" style={{ minWidth: '68px' }}>GW{gw}</th>
                    ))}
                    <th className="micro-label py-2.5 text-right w-14 pr-5" style={{ borderTopRightRadius: '10px' }}>AVG</th>
                  </tr>
                </thead>
                <tbody>
                  {planner.map((row, idx) => (
                    <tr
                      key={row.team.id}
                      style={{
                        background: idx % 2 === 1 ? 'var(--row-tint)' : 'transparent',
                        borderBottom: '1px solid var(--row-divider)',
                      }}
                    >
                      <td className="py-2.5 pl-5">
                        <span className="text-sm-design font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {row.team.short_name}
                        </span>
                      </td>
                      {gwHeaders.map(gw => {
                        const inGW = row.fixtures.filter(f => f.event === gw);
                        if (inGW.length === 0) {
                          return (
                            <td key={gw} className="py-1.5 text-center">
                              <div
                                className="inline-flex items-center justify-center rounded-md-design py-1.5 px-2"
                                style={{ background: 'var(--surface-sunken)', color: 'var(--text-tertiary)', minWidth: '56px' }}
                                title={`GW${gw}: blank`}
                              >
                                <span className="text-[10px] font-medium">BLANK</span>
                              </div>
                            </td>
                          );
                        }
                        return (
                          <td key={gw} className="py-1.5 text-center">
                            <div className="flex justify-center gap-0.5">
                              {inGW.map((f, i) => {
                                const s = getFDRStyle(f.difficulty);
                                return (
                                  <div
                                    key={i}
                                    className="inline-flex flex-col items-center justify-center rounded-md-design leading-tight"
                                    style={{ background: s.bg, color: s.text, minWidth: inGW.length > 1 ? '30px' : '56px', padding: '4px 3px' }}
                                    title={`GW${gw}: ${f.opponent} (${f.isHome ? 'H' : 'A'}) — FDR ${f.difficulty}`}
                                  >
                                    <span className="text-[10px] font-bold">{f.opponent}</span>
                                    <span className="text-[8px] opacity-75 mt-0.5">{f.isHome ? 'H' : 'A'}·{f.difficulty}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        );
                      })}
                      <td className="py-2.5 pr-5 text-right">
                        <span
                          className="mono text-sm-design font-bold"
                          style={{ color: getFDRStyle(Math.round(row.avgDifficulty)).text }}
                        >
                          {row.avgDifficulty.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ────────────────── Sub-components ────────────────── */

function SwingPanel({ title, subtitle, icon, rows }: {
  title: string; subtitle: string; icon: React.ReactNode; rows: FixtureSwing[];
}) {
  return (
    <div className="card">
      <div className="mb-4">
        <h3 className="text-base-design font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          {icon} {title}
        </h3>
        <p className="text-xs-design mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{subtitle}</p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm-design" style={{ color: 'var(--text-tertiary)' }}>No notable swings in this window.</p>
      ) : (
        <div className="space-y-3">
          {rows.map(s => {
            const accent = s.direction === 'improving' ? 'var(--semantic-green-600)' : 'var(--semantic-red-600)';
            return (
              <div key={s.team.id} className="flex items-center gap-3">
                <span className="text-sm-design font-semibold w-12 flex-shrink-0" style={{ color: 'var(--text-primary)' }}>
                  {s.team.short_name}
                </span>
                <div className="flex items-center gap-2 flex-1 text-xs-design" style={{ color: 'var(--text-secondary)' }}>
                  <span className="mono">{s.nearAvg.toFixed(2)}</span>
                  <span style={{ color: 'var(--text-tertiary)' }}>→</span>
                  <span className="mono">{s.farAvg.toFixed(2)}</span>
                </div>
                <span className="mono text-sm-design font-bold flex-shrink-0" style={{ color: accent }}>
                  {s.swing > 0 ? '−' : '+'}{Math.abs(s.swing).toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
