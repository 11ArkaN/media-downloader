/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0a',
        surface: '#141414',
        'surface-2': '#1c1c1c',
        border: '#262626',
        'border-light': '#333333',
        accent: '#ff4d00',
        'accent-dim': 'rgba(255, 77, 0, 0.12)',
        cream: '#e8e4de',
        sand: '#b8b0a2',
        ash: '#6b6660',
        chalk: '#f5f2ed',
      },
      fontFamily: {
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        sans: ['"Libre Franklin"', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', 'monospace'],
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
  ],
}
