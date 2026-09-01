interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
  /** Stagger index for animation delay (80ms per index) */
  stagger?: number;
}

export function SkeletonBlock({ className = '', style, stagger = 0 }: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        animationDelay: `${stagger * 80}ms`,
        ...style,
      }}
    />
  );
}

export function SkeletonCard({ stagger = 0 }: { stagger?: number }) {
  return (
    <div className="card space-y-3">
      <SkeletonBlock className="h-3 w-20" stagger={stagger} />
      <SkeletonBlock className="h-9 w-24" stagger={stagger + 1} />
      <SkeletonBlock className="h-3 w-32" stagger={stagger + 2} />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="card !p-0 overflow-hidden">
      {/* Header */}
      <div className="flex gap-4 p-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonBlock key={i} className="h-3 flex-1" stagger={i} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="flex gap-4 p-4 border-b last:border-0"
          style={{
            borderColor: 'var(--row-divider)',
            background: r % 2 === 1 ? 'var(--row-tint)' : undefined,
          }}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonBlock key={c} className="h-3 flex-1" stagger={r + c} />
          ))}
        </div>
      ))}
    </div>
  );
}
