import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff8ff',
          100: '#daeeff',
          200: '#bde2ff',
          300: '#90d1ff',
          400: '#5bb6fc',
          500: '#3596f5',
          600: '#1f78ea',
          700: '#1761d7',
          800: '#194fae',
          900: '#1a4489',
          950: '#152b53',
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
