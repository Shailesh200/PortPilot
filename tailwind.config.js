/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{js,ts,jsx,tsx,html}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: 'rgb(var(--bg) / <alpha-value>)',
          surface: 'rgb(var(--bg-surface) / <alpha-value>)',
          card: 'rgb(var(--bg-card) / <alpha-value>)',
          elevated: 'rgb(var(--bg-elevated) / <alpha-value>)',
          hover: 'rgb(var(--bg-hover) / <alpha-value>)'
        },
        border: {
          DEFAULT: 'rgb(var(--border) / <alpha-value>)',
          subtle: 'rgb(var(--border-subtle) / <alpha-value>)',
          strong: 'rgb(var(--border-strong) / <alpha-value>)'
        },
        text: {
          primary: 'rgb(var(--text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--text-secondary) / <alpha-value>)',
          muted: 'rgb(var(--text-muted) / <alpha-value>)'
        },
        accent: {
          DEFAULT: '#6366f1',
          hover: '#818cf8',
          muted: '#6366f120',
          strong: '#4f46e5'
        },
        danger: {
          DEFAULT: '#ef4444',
          muted: '#ef444420'
        },
        success: {
          DEFAULT: '#22c55e',
          muted: '#22c55e20'
        },
        warning: {
          DEFAULT: '#f59e0b',
          muted: '#f59e0b20'
        },
        info: {
          DEFAULT: '#3b82f6',
          muted: '#3b82f620'
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['SF Mono', 'JetBrains Mono', 'Fira Code', 'monospace']
      },
      animation: {
        'fade-in': 'fadeIn 150ms ease-out',
        'slide-up': 'slideUp 200ms ease-out',
        'slide-down': 'slideDown 200ms ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' }
        }
      }
    }
  },
  plugins: []
}
