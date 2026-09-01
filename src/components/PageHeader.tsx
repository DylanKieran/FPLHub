import { type ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  actions?: ReactNode;
}

export default function PageHeader({ title, subtitle, badge, actions }: PageHeaderProps) {
  return (
    <div className="sticky top-0 z-10 pb-4 mb-6" style={{ background: 'var(--surface-ground)' }}>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl-design font-semibold" style={{ color: 'var(--text-primary)' }}>
              {title}
            </h1>
            {badge}
          </div>
          {subtitle && (
            <p className="text-sm-design mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
