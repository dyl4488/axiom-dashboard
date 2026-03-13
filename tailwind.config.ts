import type { Config } from 'tailwindcss';

/**
 * AXIOM Dashboard — Tailwind CSS Configuration
 * Dark terminal aesthetic: black background, green/amber accents.
 */
const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // AXIOM terminal palette
        axiom: {
          bg:       '#0a0a0a',  // near-black background
          surface:  '#111111',  // card surfaces
          border:   '#1f1f1f',  // subtle borders
          green:    '#22c55e',  // active / income
          amber:    '#f59e0b',  // warning / spend
          red:      '#ef4444',  // error / loss
          blue:     '#3b82f6',  // info / positions
          muted:    '#6b7280',  // secondary text
          text:     '#e5e7eb',  // primary text
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-green': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in':    'slideIn 0.3s ease-out',
      },
      keyframes: {
        slideIn: {
          '0%':   { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
