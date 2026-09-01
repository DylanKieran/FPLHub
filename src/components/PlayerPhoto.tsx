'use client';

import { useState } from 'react';
import { playerPhotoUrl } from '@/types/fpl';
import type { FPLPlayer } from '@/types/fpl';

interface PlayerPhotoProps {
  player: Pick<FPLPlayer, 'code' | 'web_name'>;
  /** Rendered size in px. */
  size?: number;
  /** Source resolution — use the larger asset for anything above ~80px. */
  resolution?: '110x140' | '250x250';
  className?: string;
}

/**
 * Premier League player headshot.
 *
 * Not every player has a photo on the CDN (new signings especially), so this
 * falls back to the player's initials rather than a broken image.
 */
export default function PlayerPhoto({
  player,
  size = 80,
  resolution,
  className = '',
}: PlayerPhotoProps) {
  const [failed, setFailed] = useState(false);

  const res = resolution ?? (size > 80 ? '250x250' : '110x140');
  const initials = player.web_name
    .split(/[\s-]+/)
    .map(part => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const baseStyle = {
    width: size,
    height: size,
    background: 'var(--surface-sunken)',
  } as const;

  if (failed) {
    return (
      <div
        className={`rounded-lg-design flex-shrink-0 flex items-center justify-center font-semibold ${className}`}
        style={{
          ...baseStyle,
          color: 'var(--text-tertiary)',
          fontSize: Math.max(12, size * 0.3),
        }}
        aria-label={player.web_name}
      >
        {initials}
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg-design flex-shrink-0 overflow-hidden ${className}`}
      style={baseStyle}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={playerPhotoUrl(player, res)}
        alt={player.web_name}
        width={size}
        height={size}
        loading="lazy"
        onError={() => setFailed(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }}
      />
    </div>
  );
}
