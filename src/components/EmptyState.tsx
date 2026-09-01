import { type ReactNode } from 'react';
import { AlertCircle, Search, Clock, Lock } from 'lucide-react';

type Variant = 'first-run' | 'no-results' | 'stale' | 'pre-season' | 'error';

const icons: Record<Variant, typeof AlertCircle> = {
  'first-run': Search,
  'no-results': Search,
  'stale': Clock,
  'pre-season': Lock,
  'error': AlertCircle,
};

interface EmptyStateProps {
  variant: Variant;
  title: string;
  description: string;
  action?: ReactNode;
}

export default function EmptyState({ variant, title, description, action }: EmptyStateProps) {
  const Icon = icons[variant];
  const isError = variant === 'error';

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto">
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
        style={{
          background: isError ? 'var(--semantic-red-50)' : 'var(--semantic-blue-50)',
        }}
      >
        <Icon
          size={22}
          style={{
            color: isError ? 'var(--semantic-red-500)' : 'var(--semantic-blue-500)',
          }}
        />
      </div>
      <h3 className="text-base-design font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
        {title}
      </h3>
      <p className="text-sm-design" style={{ color: 'var(--text-secondary)' }}>
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
