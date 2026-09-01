interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  footnote?: string;
  /** Small secondary label shown top-right of the card (e.g. "avg 51", "ITB £0.8m") */
  topRight?: string;
}

export default function StatCard({ label, value, subValue, trend, footnote, topRight }: StatCardProps) {
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <p className="micro-label">{label}</p>
        {topRight && (
          <span className="text-xs-design" style={{ color: 'var(--text-tertiary)' }}>{topRight}</span>
        )}
      </div>
      <p className="stat-value mt-1">{value}</p>
      {subValue && (
        <p className="text-sm-design mt-1 flex items-center gap-1">
          {trend === 'up' && (
            <span style={{ color: 'var(--semantic-green-600)' }}>▲</span>
          )}
          {trend === 'down' && (
            <span style={{ color: 'var(--semantic-red-600)' }}>▼</span>
          )}
          <span style={{ color: trend === 'up' ? 'var(--semantic-green-600)' : trend === 'down' ? 'var(--semantic-red-600)' : 'var(--text-secondary)' }}>{subValue}</span>
        </p>
      )}
      {footnote && (
        <p className="text-xs-design mt-2" style={{ color: 'var(--text-tertiary)' }}>
          {footnote}
        </p>
      )}
    </div>
  );
}
