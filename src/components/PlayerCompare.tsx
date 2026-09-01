'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import PlayerPhoto from '@/components/PlayerPhoto';
import { POSITION_MAP } from '@/types/fpl';
import {
  defconPointsPer90, defconHitRate, isDefconEligible, hasDefconData,
  getAvailability, availabilityColor,
} from '@/lib/algorithms';
import type { FPLPlayer, FPLTeam } from '@/types/fpl';

interface FixtureInfo { event: number; opponent: string; isHome: boolean; difficulty: number }

interface ComparePlayer {
  player: FPLPlayer;
  team: FPLTeam | undefined;
  fixtures: FixtureInfo[];
}

interface PlayerCompareProps {
  players: ComparePlayer[];
  onClose: () => void;
  onRemove: (playerId: number) => void;
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

/** A row of the comparison table. `higherIsBetter: null` disables highlighting. */
interface MetricRow {
  label: string;
  values: number[];
  display: string[];
  higherIsBetter: boolean | null;
}

export default function PlayerCompare({ players, onClose, onRemove }: PlayerCompareProps) {
  // Close on Escape — expected behaviour for a modal.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (players.length === 0) return null;

  const num = (v: string | number | null | undefined) => {
    const n = typeof v === 'number' ? v : parseFloat(String(v ?? '0'));
    return isNaN(n) ? 0 : n;
  };

  const metrics: MetricRow[] = [
    {
      label: 'Price',
      values: players.map(p => p.player.now_cost),
      display: players.map(p => `£${(p.player.now_cost / 10).toFixed(1)}m`),
      higherIsBetter: null, // Cheaper isn't strictly better — depends on budget.
    },
    {
      label: 'Total points',
      values: players.map(p => p.player.total_points),
      display: players.map(p => String(p.player.total_points)),
      higherIsBetter: true,
    },
    {
      label: 'Points per game',
      values: players.map(p => num(p.player.points_per_game)),
      display: players.map(p => p.player.points_per_game),
      higherIsBetter: true,
    },
    {
      label: 'Form',
      values: players.map(p => num(p.player.form)),
      display: players.map(p => p.player.form),
      higherIsBetter: true,
    },
    {
      label: 'Ownership',
      values: players.map(p => num(p.player.selected_by_percent)),
      display: players.map(p => `${p.player.selected_by_percent}%`),
      higherIsBetter: null, // High ownership is safety; low is differential upside.
    },
    {
      label: 'Minutes',
      values: players.map(p => p.player.minutes),
      display: players.map(p => p.player.minutes.toLocaleString()),
      higherIsBetter: true,
    },
    {
      label: 'Starts',
      values: players.map(p => p.player.starts),
      display: players.map(p => String(p.player.starts)),
      higherIsBetter: true,
    },
    {
      label: 'Goals',
      values: players.map(p => p.player.goals_scored),
      display: players.map(p => String(p.player.goals_scored)),
      higherIsBetter: true,
    },
    {
      label: 'Assists',
      values: players.map(p => p.player.assists),
      display: players.map(p => String(p.player.assists)),
      higherIsBetter: true,
    },
    {
      label: 'xG / 90',
      values: players.map(p => p.player.expected_goals_per_90 ?? 0),
      display: players.map(p => (p.player.expected_goals_per_90 ?? 0).toFixed(2)),
      higherIsBetter: true,
    },
    {
      label: 'xA / 90',
      values: players.map(p => p.player.expected_assists_per_90 ?? 0),
      display: players.map(p => (p.player.expected_assists_per_90 ?? 0).toFixed(2)),
      higherIsBetter: true,
    },
    {
      label: 'xGI / 90',
      values: players.map(p => p.player.expected_goal_involvements_per_90 ?? 0),
      display: players.map(p => (p.player.expected_goal_involvements_per_90 ?? 0).toFixed(2)),
      higherIsBetter: true,
    },
    {
      label: 'DefCon / 90',
      values: players.map(p =>
        isDefconEligible(p.player.element_type) && hasDefconData(p.player) ? defconPointsPer90(p.player) : 0
      ),
      display: players.map(p =>
        !isDefconEligible(p.player.element_type) ? '—'
          : !hasDefconData(p.player) ? '—'
          : defconPointsPer90(p.player).toFixed(2)
      ),
      higherIsBetter: true,
    },
    {
      label: 'DefCon hit rate',
      values: players.map(p => hasDefconData(p.player) ? defconHitRate(p.player) : 0),
      display: players.map(p =>
        !isDefconEligible(p.player.element_type) || !hasDefconData(p.player)
          ? '—'
          : `${Math.round(defconHitRate(p.player) * 100)}%`
      ),
      higherIsBetter: true,
    },
    {
      label: 'Bonus',
      values: players.map(p => p.player.bonus),
      display: players.map(p => String(p.player.bonus)),
      higherIsBetter: true,
    },
    {
      label: 'ICT index',
      values: players.map(p => num(p.player.ict_index)),
      display: players.map(p => num(p.player.ict_index).toFixed(1)),
      higherIsBetter: true,
    },
    {
      label: 'FPL xPts (next GW)',
      values: players.map(p => num(p.player.ep_next)),
      display: players.map(p => p.player.ep_next ? num(p.player.ep_next).toFixed(1) : '—'),
      higherIsBetter: true,
    },
    {
      label: 'Next 5 avg FDR',
      values: players.map(p =>
        p.fixtures.length ? p.fixtures.reduce((s, f) => s + f.difficulty, 0) / p.fixtures.length : 0
      ),
      display: players.map(p =>
        p.fixtures.length
          ? (p.fixtures.reduce((s, f) => s + f.difficulty, 0) / p.fixtures.length).toFixed(2)
          : '—'
      ),
      higherIsBetter: false, // Lower difficulty is better.
    },
  ];

  /** Index of the winning column, or null when tied / not comparable. */
  function bestIndex(row: MetricRow): number | null {
    if (row.higherIsBetter === null) return null;
    const valid = row.values.filter((v, i) => row.display[i] !== '—');
    if (valid.length < 2) return null;
    const target = row.higherIsBetter ? Math.max(...valid) : Math.min(...valid);
    // A value shared by every column isn't a "win".
    if (valid.every(v => v === target)) return null;
    return row.values.findIndex((v, i) => v === target && row.display[i] !== '—');
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Player comparison"
    >
      <div
        className="card w-full my-8"
        style={{ maxWidth: '900px' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-lg-design font-semibold" style={{ color: 'var(--text-primary)' }}>
              Compare players
            </h2>
            <p className="text-xs-design mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
              Best value in each row is highlighted
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-md-design flex items-center justify-center transition-colors"
            style={{ background: 'var(--surface-sunken)', color: 'var(--text-secondary)' }}
            aria-label="Close comparison"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-x-auto -mx-5">
          <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr>
                <th className="text-left micro-label py-2 pl-5" style={{ minWidth: '130px' }} />
                {players.map(({ player, team }) => {
                  const availability = getAvailability(player);
                  return (
                    <th key={player.id} className="py-2 px-3 align-bottom" style={{ minWidth: '150px' }}>
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="relative">
                          <PlayerPhoto player={player} size={48} />
                          <button
                            type="button"
                            onClick={() => onRemove(player.id)}
                            className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                            style={{ background: 'var(--semantic-red-500)', color: '#fff' }}
                            aria-label={`Remove ${player.web_name}`}
                          >
                            <X size={9} />
                          </button>
                        </div>
                        <p className="text-sm-design font-semibold text-center" style={{ color: 'var(--text-primary)' }}>
                          {player.web_name}
                        </p>
                        <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                          {team?.short_name} · {POSITION_MAP[player.element_type]}
                        </p>
                        {availability.level !== 'available' && (
                          <span
                            className="text-[9px] font-medium px-1.5 py-0.5 rounded-sm-design"
                            style={{ background: 'var(--surface-sunken)', color: availabilityColor(availability.level) }}
                          >
                            {availability.label}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {metrics.map((row, ri) => {
                const best = bestIndex(row);
                return (
                  <tr
                    key={row.label}
                    style={{
                      background: ri % 2 === 1 ? 'var(--row-tint)' : 'transparent',
                      borderTop: '1px solid var(--row-divider)',
                    }}
                  >
                    <td className="py-2.5 pl-5 text-sm-design" style={{ color: 'var(--text-secondary)' }}>
                      {row.label}
                    </td>
                    {row.display.map((d, i) => (
                      <td key={i} className="py-2.5 px-3 text-center">
                        <span
                          className="mono text-sm-design"
                          style={{
                            color: best === i ? 'var(--semantic-green-600)' : 'var(--text-primary)',
                            fontWeight: best === i ? 700 : 500,
                          }}
                        >
                          {d}
                        </span>
                      </td>
                    ))}
                  </tr>
                );
              })}

              {/* Upcoming fixtures */}
              <tr style={{ borderTop: '1px solid var(--row-divider)' }}>
                <td className="py-3 pl-5 text-sm-design align-top" style={{ color: 'var(--text-secondary)' }}>
                  Next fixtures
                </td>
                {players.map(({ player, fixtures }) => (
                  <td key={player.id} className="py-3 px-3">
                    <div className="flex justify-center gap-1">
                      {fixtures.length === 0 ? (
                        <span className="text-xs-design" style={{ color: 'var(--text-tertiary)' }}>—</span>
                      ) : (
                        fixtures.map((f, i) => {
                          const s = getFDRStyle(f.difficulty);
                          return (
                            <div
                              key={i}
                              className="flex flex-col items-center rounded-sm-design px-1 py-0.5"
                              style={{ background: s.bg, color: s.text }}
                              title={`GW${f.event}: ${f.opponent} (${f.isHome ? 'H' : 'A'})`}
                            >
                              <span className="text-[9px] font-bold">{f.opponent}</span>
                              <span className="text-[8px] opacity-75">{f.isHome ? 'H' : 'A'}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
