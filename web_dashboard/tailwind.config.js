/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base: {
          950: '#070B14',
          900: '#0B1220',
          800: '#111A2E',
          700: '#1A2540',
          600: '#26355A',
          500: '#3A4C77',
        },
        signal: {
          amber: '#F5A623',
          green: '#22C55E',
          red: '#EF4444',
          blue: '#3B82F6',
          violet: '#8B5CF6',
        },
        ink: {
          100: '#E7ECF6',
          300: '#B7C2DC',
          500: '#8592B4',
          700: '#5A6688',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        panel: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.6)',
      },
      animation: {
        pulseSlow: 'pulse 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
