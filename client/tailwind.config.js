/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#d9e6ff',
          200: '#bcd4ff',
          300: '#8ebbff',
          400: '#5996ff',
          500: '#3370ff',
          600: '#1a4fff',
          700: '#143dee',
          800: '#1733c0',
          900: '#192f97',
        },
        surface: {
          0: '#0a0e1a',
          50: '#0f1425',
          100: '#141a30',
          200: '#1a2140',
          300: '#232c52',
          400: '#2d3766',
          500: '#3d4a7a',
        },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      boxShadow: {
        'glow-sm': '0 2px 8px rgba(51, 112, 255, 0.15)',
        'glow': '0 4px 20px rgba(51, 112, 255, 0.25)',
        'glow-lg': '0 8px 40px rgba(51, 112, 255, 0.3)',
        'card': '0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)',
        'card-dark': '0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)',
      },
    },
  },
  plugins: [],
}
