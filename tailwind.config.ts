import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          ground: 'var(--surface-ground)',
          raised: 'var(--surface-raised)',
          sunken: 'var(--surface-sunken)',
        },
        border: {
          subtle: 'var(--border-subtle)',
          DEFAULT: 'var(--border-default)',
        },
        txt: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
        },
        semantic: {
          'green-600': 'var(--semantic-green-600)',
          'green-500': 'var(--semantic-green-500)',
          'green-100': 'var(--semantic-green-100)',
          'green-50': 'var(--semantic-green-50)',
          'red-600': 'var(--semantic-red-600)',
          'red-500': 'var(--semantic-red-500)',
          'red-100': 'var(--semantic-red-100)',
          'red-50': 'var(--semantic-red-50)',
          'amber-600': 'var(--semantic-amber-600)',
          'amber-500': 'var(--semantic-amber-500)',
          'amber-100': 'var(--semantic-amber-100)',
          'amber-50': 'var(--semantic-amber-50)',
          'blue-600': 'var(--semantic-blue-600)',
          'blue-500': 'var(--semantic-blue-500)',
          'blue-100': 'var(--semantic-blue-100)',
          'blue-50': 'var(--semantic-blue-50)',
        },
        viz: {
          steel: '#4C72B0',
          tangerine: '#DD8452',
          sage: '#55A868',
          coral: '#C44E52',
          mauve: '#8172B3',
          sand: '#CCB974',
        },
        fdr: {
          '1-bg': '#DAFBE1', '1-text': '#1B873B',
          '2-bg': '#C3F7CB', '2-text': '#1B873B',
          '3-bg': '#FFF4CC', '3-text': '#BF8700',
          '4-bg': '#FFCECB', '4-text': '#CF222E',
          '5-bg': '#F8B4B4', '5-text': '#9E1B1B',
        },
        pos: {
          gkp: '#E8A317',
          def: '#2196F3',
          mid: '#28A745',
          fwd: '#DC3545',
        },
        pitch: {
          base: '#2D8A4E',
        },
        // Keep old fpl colors for any unreferenced code during transition
        fpl: {
          purple: '#37003c',
          green: '#00ff87',
          pink: '#e90052',
          cyan: '#04f5ff',
          dark: '#1a0a2e',
          darker: '#0d0518',
          card: '#241442',
          border: '#3d1f6d',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'xs-design': ['11px', { lineHeight: '16px' }],
        'sm-design': ['13px', { lineHeight: '18px' }],
        'base-design': ['15px', { lineHeight: '22px' }],
        'lg-design': ['18px', { lineHeight: '26px' }],
        'xl-design': ['22px', { lineHeight: '28px' }],
        '2xl-design': ['28px', { lineHeight: '34px' }],
        '3xl-design': ['36px', { lineHeight: '42px' }],
      },
      boxShadow: {
        'level-1': '0 1px 3px rgba(0,0,0,0.08)',
        'level-1-nested': '0 1px 3px rgba(0,0,0,0.06)',
        'level-2': '0 4px 12px rgba(0,0,0,0.10)',
        'level-3': '0 8px 24px rgba(0,0,0,0.14)',
      },
      borderRadius: {
        'sm-design': '6px',
        'md-design': '10px',
        'lg-design': '14px',
      },
      keyframes: {
        omPulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
      },
      animation: {
        'skeleton-pulse': 'omPulse 1.6s ease-in-out infinite',
      },
      transitionTimingFunction: {
        'ease-expand': 'ease-out',
      },
      transitionDuration: {
        '200': '200ms',
        '250': '250ms',
        '300': '300ms',
      },
      maxWidth: {
        'content': '1280px',
      },
    },
  },
  plugins: [],
};

export default config;
