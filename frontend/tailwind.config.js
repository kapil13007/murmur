// File: frontend/tailwind.config.js
// Semantic colours (canvas, panel, ink, ...) are CSS variables defined in
// src/index.css so the light and dark themes swap in one place. The brand
// palettes (sand, vast, dawn, fathom, ...) follow Wispr Flow's design tokens.
const withAlpha = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Figtree', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['"EB Garamond"', 'Georgia', 'serif'],
        mono: ['ui-monospace', 'Consolas', 'monospace'],
      },
      colors: {
        canvas: withAlpha('canvas'),
        panel: withAlpha('panel'),
        raised: withAlpha('raised'),
        subtle: withAlpha('subtle'),
        line: withAlpha('line'),
        ink: withAlpha('ink'),
        muted: withAlpha('muted'),
        faint: withAlpha('faint'),
        primary: withAlpha('primary'),
        'on-primary': withAlpha('on-primary'),
        sand: {
          50: '#fcfcfb', 100: '#faf9f7', 200: '#f8f7f3', 300: '#f7f6f2', 400: '#f6f5f1',
          500: '#f5f4f0', 600: '#eeebe3', 700: '#c5c0b3', 800: '#a39d8e', 900: '#736e62', 950: '#4d4a42',
        },
        vast: {
          50: '#e9e8e1', 100: '#deddd7', 200: '#c8c8c2', 300: '#b3b2ad', 400: '#9d9c98',
          500: '#878683', 600: '#71716e', 700: '#5b5b59', 800: '#464544', 900: '#30302f', 950: '#1a1a1a',
        },
        dawn: {
          50: '#fdfbff', 100: '#fcf7ff', 200: '#faf1ff', 300: '#f7ebff', 400: '#f4e1ff',
          500: '#f0d7ff', 600: '#d2ace9', 700: '#a26ec1', 800: '#6c358c', 900: '#502b66',
        },
        fathom: {
          50: '#e2f5f2', 100: '#ceedea', 200: '#b8e4dc', 300: '#9fd9cf', 400: '#84cdc1',
          500: '#68bdb0', 600: '#4daa9d', 700: '#369489', 800: '#247872', 900: '#1a5c5c', 950: '#034f46',
        },
        glow: { 50: '#fdf3ea', 100: '#fce5d1', 200: '#facda1', 300: '#ffa946', 400: '#d7892a', 500: '#af6a06' },
        flare: { 50: '#fdf2f0', 100: '#fce4de', 200: '#fac9be', 300: '#f9a28e', 400: '#ff6c4c', 500: '#d34528', 600: '#a6280b' },
        signal: { 100: '#fff2fc', 200: '#ffe4fa', 300: '#ffd7f7', 500: '#ffbcf2', 700: '#c56cb4', 800: '#a3398f' },
        chord: { 100: '#efe5fc', 200: '#e1cbf9', 400: '#c29be1', 500: '#965ace', 600: '#7232a6', 700: '#571b83' },
      },
      boxShadow: {
        panel: '0 1px 2px rgba(26,26,26,0.04), 0 0 0 1px rgb(var(--line) / 1)',
        pop: '0 12px 32px -8px rgba(26,26,26,0.18), 0 0 0 1px rgb(var(--line) / 1)',
        key: '0 2px 0 rgb(var(--line) / 1)',
      },
      keyframes: {
        'fade-in': { from: { opacity: 0 }, to: { opacity: 1 } },
        'pop-in': { from: { opacity: 0, transform: 'translateY(6px) scale(0.98)' }, to: { opacity: 1, transform: 'none' } },
        'wave': { '0%, 100%': { transform: 'scaleY(0.35)' }, '50%': { transform: 'scaleY(1)' } },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'pop-in': 'pop-in 180ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        wave: 'wave 1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
