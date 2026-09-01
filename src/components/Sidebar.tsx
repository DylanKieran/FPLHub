'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  BarChart3,
  ArrowLeftRight,
  Star,
  LayoutGrid,
  CalendarRange,
  Sun,
  Moon,
} from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/players', label: 'Player Explorer', icon: Users },
  { href: '/team', label: 'Team Analyser', icon: BarChart3 },
  { href: '/transfers', label: 'Transfer Hub', icon: ArrowLeftRight },
  { href: '/planner', label: 'Fixture Planner', icon: CalendarRange },
  { href: '/captain', label: 'Captain & Chips', icon: Star },
  { href: '/squad-builder', label: 'Squad Builder', icon: LayoutGrid },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('fpl-theme');
    if (stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('fpl-theme', next ? 'dark' : 'light');
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-surface-sunken flex flex-col z-50 border-r border-border-subtle">
      {/* Logo */}
      <div className="px-5 pt-6 pb-5">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md-design bg-txt-primary flex items-center justify-center">
            <span className="text-surface-raised font-bold text-base-design">F</span>
          </div>
          <div>
            <h1 className="font-semibold text-sm-design" style={{ color: 'var(--text-primary)' }}>FPL Analytics</h1>
            <p className="micro-label" style={{ fontSize: '9px', letterSpacing: '0.12em' }}>Hub</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={isActive ? 'nav-link-active' : 'nav-link'}
            >
              <Icon size={18} strokeWidth={isActive ? 2 : 1.5} />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {/* Divider after Squad Builder */}
        <div className="!mt-3 !mb-3 border-t border-border-subtle" />
      </nav>

      {/* Deadline countdown card */}
      <div className="px-3 pb-3">
        <div className="card !p-3 !rounded-lg-design text-center">
          <p className="micro-label mb-1">Next Deadline</p>
          <p className="mono text-lg-design" style={{ color: 'var(--text-primary)' }}>--:--:--</p>
          <p className="text-xs-design mt-1" style={{ color: 'var(--text-tertiary)' }}>Awaiting GW data</p>
        </div>
      </div>

      {/* Theme toggle */}
      <div className="px-3 pb-2">
        <button onClick={toggleTheme} className="w-full flex items-center justify-center gap-2 py-2 rounded-md-design transition-colors text-sm-design" style={{ color: 'var(--text-secondary)', background: 'var(--surface-ground)' }}>
          {dark ? <Sun size={14} /> : <Moon size={14} />}
          <span>{dark ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
      </div>

      {/* Footer */}
      <div className="px-4 pb-4">
        <p className="text-[10px] text-center" style={{ color: 'var(--text-tertiary)' }}>
          Data from FPL API
        </p>
        <p className="text-[10px] text-center mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
          2026/27 Season
        </p>
      </div>
    </aside>
  );
}
