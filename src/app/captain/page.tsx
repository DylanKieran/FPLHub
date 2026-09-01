'use client';

import { useState, useEffect, useMemo } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import PlayerPhoto from '@/components/PlayerPhoto';
import { Crown, AlertCircle } from 'lucide-react';
import { POSITION_MAP } from '@/types/fpl';
import { getCaptainPicks, getChipStrategy } from '@/lib/algorithms';
import type { FPLFixture, FPLBootstrap } from '@/types/fpl';
import type { CaptainPick, ChipRecommendation } from '@/lib/algorithms';

const CHIP_COLORS: Record<string, { bg: string; text: string }> = {
  bboost: { bg: 'var(--semantic-green-500)', text: 'var(--semantic-green-600)' },
  wildcard: { bg: 'var(--semantic-blue-500)', text: 'var(--semantic-blue-600)' },
  '3xc': { bg: 'var(--semantic-amber-500)', text: 'var(--semantic-amber-600)' },
  freehit: { bg: '#CCB974', text: '#8B7238' },
};

const CHIP_ABBR: Record<string, string> = { wildcard: 'WC', freehit: 'FH', bboost: 'BB', '3xc': 'TC' };

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

function getCountdown(deadlineIso: string): string {
  const diffMs = new Date(deadlineIso).getTime() - Date.now();
  if (diffMs <= 0) return 'now';
  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
}

export default function CaptainPage() {
  const [bootstrap, setBootstrap] = useState<FPLBootstrap | null>(null);
  const [fixtures, setFixtures] = useState<FPLFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBase() {
      try {
        const [bsRes, fxRes] = await Promise.all([fetch('/api/fpl/bootstrap'), fetch('/api/fpl/fixtures')]);
        if (!bsRes.ok || !fxRes.ok) throw new Error('Failed to fetch FPL data');
        setBootstrap(await bsRes.json());
        setFixtures(await fxRes.json());
      } catch { setError('Failed to load FPL data'); } finally { setLoading(false); }
    }
    fetchBase();
  }, []);

  const currentEvent = useMemo(() => bootstrap?.events.find(e => e.is_current) ?? null, [bootstrap]);
  const nextEvent = useMemo(() => bootstrap?.events.find(e => e.is_next) ?? null, [bootstrap]);
  const gwLabel = nextEvent?.id ?? currentEvent?.id ?? '?';
  const deadlineEvent = nextEvent ?? currentEvent;

  const captainPicks = useMemo<CaptainPick[]>(() => {
    if (!bootstrap || !fixtures.length) return [];
    return getCaptainPicks(bootstrap.elements, bootstrap.teams, fixtures, bootstrap.events, 5);
  }, [bootstrap, fixtures]);

  const maxScore = useMemo(() => Math.max(...captainPicks.map(p => p.score), 1), [captainPicks]);

  const chipStrategy = useMemo<ChipRecommendation[]>(() => {
    if (!bootstrap || !fixtures.length) return [];
    return getChipStrategy(bootstrap.events, fixtures, bootstrap.teams, [], bootstrap.chips);
  }, [bootstrap, fixtures]);

  // 2026/27 runs two chip sets; first-half chips expire at the GW19 deadline.
  const firstHalfChips = useMemo(() => chipStrategy.filter(c => c.half === 1), [chipStrategy]);
  const secondHalfChips = useMemo(() => chipStrategy.filter(c => c.half === 2), [chipStrategy]);
  const expiringChips = useMemo(() => chipStrategy.filter(c => c.expiringSoon), [chipStrategy]);

  const communityPick = useMemo(() => {
    if (!bootstrap) return null;
    const ref = currentEvent ?? bootstrap.events.find(e => e.is_previous) ?? null;
    if (!ref?.most_captained) return null;
    const player = bootstrap.elements.find(p => p.id === ref.most_captained);
    if (!player) return null;
    return { name: player.web_name, pct: player.selected_by_percent };
  }, [bootstrap, currentEvent]);

  const timelineGWs = useMemo(() => {
    const start = typeof gwLabel === 'number' ? gwLabel : 1;
    return Array.from({ length: 39 - start }, (_, i) => start + i).filter(gw => gw <= 38);
  }, [gwLabel]);

  const bestGwMap = useMemo(() => {
    const map = new Map<number, { chip: string; subLabel: string | null }>();
    for (const chip of chipStrategy) {
      if (chip.bestGameweek) map.set(chip.bestGameweek, { chip: chip.chip, subLabel: chip.subLabel });
    }
    return map;
  }, [chipStrategy]);

  if (loading) return <LoadingSpinner message="Loading FPL data..." />;
  if (error) return <EmptyState variant="error" title="Error" description={error} />;

  const heroPick = captainPicks[0] ?? null;
  const altPicks = captainPicks.slice(1);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Captain & Chips"
        subtitle={`GW${gwLabel}${deadlineEvent ? ` · deadline in ${getCountdown(deadlineEvent.deadline_time)}` : ''}`}
        actions={
          communityPick ? (
            <div className="rounded-lg-design border px-4 py-2 flex items-center gap-2" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-raised)' }}>
              <span className="text-xs-design" style={{ color: 'var(--text-tertiary)' }}>Community pick</span>
              <span className="text-sm-design font-semibold" style={{ color: 'var(--text-primary)' }}>{communityPick.name}</span>
              <span className="text-xs-design" style={{ color: 'var(--text-tertiary)' }}>· {communityPick.pct}%</span>
            </div>
          ) : undefined
        }
      />

      {/* Two-column: captain hero + alternatives */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        {/* Hero pick */}
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
                { label: 'SEASON PTS', value: heroPick.player.total_points },
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

        {/* Alternatives */}
        <div className="space-y-4">
          <h2 className="text-lg-design font-semibold" style={{ color: 'var(--text-primary)' }}>Alternatives</h2>
          {altPicks.length === 0 ? (
            <div className="card">
              <p className="text-sm-design" style={{ color: 'var(--text-tertiary)' }}>No other captain options available.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {altPicks.map((pick, idx) => {
                const pct = (pick.score / maxScore) * 100;
                return (
                  <div key={pick.player.id} className="card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="mono text-xs-design flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>{idx + 2}</span>
                        <PlayerPhoto player={pick.player} size={32} />
                        <div className="min-w-0">
                          <p className="text-base-design font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{pick.player.web_name}</p>
                          <span className="text-xs-design whitespace-nowrap" style={{ color: 'var(--text-tertiary)' }}>
                            {pick.team.short_name} · £{(pick.player.now_cost / 10).toFixed(1)}m
                          </span>
                        </div>
                      </div>
                      <span className="text-lg-design font-bold flex-shrink-0" style={{ color: 'var(--text-primary)' }}>{pick.score.toFixed(1)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-sunken)' }}>
                        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: 'var(--semantic-blue-500)' }} />
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {pick.fixtures.map((f, fi) => {
                          const s = getFDRStyle(f.difficulty);
                          return (
                            <span key={fi} className="text-[10px] font-semibold px-1.5 py-1 rounded-sm-design" style={{ background: s.bg, color: s.text }}>
                              {f.opponent}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <p className="text-sm-design mt-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{pick.reasoning}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Chip Strategy */}
      {chipStrategy.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg-design font-semibold" style={{ color: 'var(--text-primary)' }}>
              Chip strategy · GW{timelineGWs[0]} to GW{timelineGWs[timelineGWs.length - 1]}
            </h2>
            <span className="text-xs-design" style={{ color: 'var(--text-tertiary)' }}>
              {chipStrategy.length} chip{chipStrategy.length === 1 ? '' : 's'} available across {secondHalfChips.length > 0 && firstHalfChips.length > 0 ? 'both halves' : 'this half'}
            </span>
          </div>

          {/* Expiry warning — set 1 chips are void after GW19 */}
          {expiringChips.length > 0 && (
            <div className="rounded-md-design p-3.5 flex items-start gap-2.5" style={{ background: 'var(--semantic-red-50)', border: '1px solid var(--semantic-red-100)' }}>
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--semantic-red-600)' }} />
              <div>
                <p className="text-sm-design font-medium" style={{ color: 'var(--semantic-red-600)' }}>
                  {expiringChips.length} chip{expiringChips.length === 1 ? '' : 's'} expiring soon
                </p>
                <p className="text-xs-design mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {expiringChips.map(c => `${c.chipLabel} (GW${c.window.stop})`).join(', ')} — unused chips are lost, not carried over.
                </p>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="card">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {timelineGWs.map(gw => {
                const info = bestGwMap.get(gw);
                const colors = info ? CHIP_COLORS[info.chip] : null;
                // GW19 is the hard boundary between the two chip sets.
                const isHalfBoundary = gw === 19;
                return (
                  <div key={gw} className="flex items-stretch flex-shrink-0">
                    <div className="flex flex-col items-center" style={{ minWidth: '64px' }}>
                      <div className="h-6 flex items-center justify-center mb-1">
                        {info && colors && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-sm-design" style={{ background: colors.bg, color: '#fff' }}>
                            {CHIP_ABBR[info.chip]}
                          </span>
                        )}
                      </div>
                      <div
                        className="w-full rounded-md-design py-2.5 text-center"
                        style={{
                          border: info && colors ? `2px solid ${colors.bg}` : '1px solid var(--border-subtle)',
                          background: 'var(--surface-raised)',
                        }}
                      >
                        <p className="text-sm-design font-semibold" style={{ color: 'var(--text-primary)' }}>{gw}</p>
                        {info?.subLabel && colors && (
                          <p className="text-[9px] font-semibold mt-0.5" style={{ color: colors.text, letterSpacing: '0.05em' }}>{info.subLabel}</p>
                        )}
                      </div>
                    </div>
                    {isHalfBoundary && (
                      <div className="flex flex-col items-center justify-end mx-1.5" title="Chip set 1 expires after GW19">
                        <div className="w-px flex-1 mb-1" style={{ background: 'var(--semantic-red-500)' }} />
                        <span className="text-[8px] font-bold whitespace-nowrap pb-3" style={{ color: 'var(--semantic-red-600)', writingMode: 'vertical-rl' }}>
                          SET 1 ENDS
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chip description cards, grouped by half */}
          {[
            { half: 1 as const, chips: firstHalfChips, label: 'First half · expires GW19' },
            { half: 2 as const, chips: secondHalfChips, label: 'Second half · GW20 onward' },
          ].filter(g => g.chips.length > 0).map(group => (
            <div key={group.half} className="space-y-3">
              {firstHalfChips.length > 0 && secondHalfChips.length > 0 && (
                <p className="micro-label">{group.label}</p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {group.chips.map(chip => {
                  const colors = CHIP_COLORS[chip.chip] ?? { bg: 'var(--surface-sunken)', text: 'var(--text-primary)' };
                  return (
                    <div
                      key={`${chip.chip}-${chip.half}`}
                      className="card"
                      style={chip.expiringSoon ? { border: '1px solid var(--semantic-red-100)' } : undefined}
                    >
                      <div className="flex items-center gap-2.5 mb-3">
                        <span
                          className="w-8 h-8 rounded-md-design flex items-center justify-center text-xs-design font-bold flex-shrink-0"
                          style={{ background: colors.bg, color: '#fff' }}
                        >
                          {CHIP_ABBR[chip.chip] || '?'}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm-design font-semibold" style={{ color: 'var(--text-primary)' }}>{chip.chipLabel}</p>
                          <p className="text-xs-design" style={{ color: 'var(--text-tertiary)' }}>
                            {chip.bestGameweek ? `GW${chip.bestGameweek}` : 'No recommendation'}
                            <span style={{ opacity: 0.6 }}> · window GW{chip.window.start}–{chip.window.stop}</span>
                          </p>
                        </div>
                      </div>
                      <p className="text-sm-design leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{chip.reasoning}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
