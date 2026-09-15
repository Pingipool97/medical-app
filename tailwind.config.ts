import type { Config } from 'tailwindcss';

// Palette HABITUS: i valori sono campionati dai pixel del logo (assets/Logo intero.png).
// `brand` = navy/indaco del wordmark e delle cornici; `accent` = teal/verde della figura.
// Tutta la UI passa da questi token: cambiarli qui ribranda l'app senza toccare i componenti.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f3f6fc',
          100: '#e4ebf7',
          200: '#cbd9ee',
          300: '#a8bfe0',
          400: '#7e9dcd',
          500: '#5d7eb8',
          600: '#486e94', // cornici logo piccolo
          700: '#3a4788', // "FISIO·BENESSERE", cornici interne
          800: '#2c2a6b',
          900: '#221455',
          950: '#1e104a', // navy del wordmark HABITUS
        },
        accent: {
          50: '#f0f8f6',
          100: '#d9ede8',
          200: '#b5dbd3',
          300: '#86c2b7',
          400: '#5ba79a',
          500: '#4a9b8e',
          600: '#529091', // teal figura
          700: '#3d7475',
          800: '#345d5e',
          900: '#2d4d4e',
          950: '#1a2f30',
        },
        clinical: {
          alert: '#dc2626',
          warn: '#d97706',
          ok: '#059669',
        },
      },
      fontSize: {
        base: ['1.0625rem', '1.6'],
      },
    },
  },
  plugins: [],
};
export default config;
