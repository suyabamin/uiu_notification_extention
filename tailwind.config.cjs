/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{html,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--bg)',
        surface: 'var(--surface)',
        text: 'var(--text)',
        muted: 'var(--muted)',
        primary: {
          DEFAULT: 'var(--primary)',
          light: '#2563EB',
          dark: '#60A5FA',
        },
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        elms: {
          DEFAULT: '#7C3AED',
          dark: '#A78BFA',
          light: '#7C3AED',
          subtle: 'rgba(124, 58, 237, 0.1)',
        },
        ucam: {
          DEFAULT: '#0891B2',
          dark: '#22D3EE',
          light: '#0891B2',
          subtle: 'rgba(8, 145, 178, 0.1)',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'Noto Sans Bengali',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        bengali: ['Noto Sans Bengali', 'sans-serif'],
      },
      borderRadius: {
        card: '12px',
        control: '8px',
      },
    },
  },
  plugins: [],
};
