/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#ecf8f3',
          100: '#d1eee2',
          200: '#a4ddc4',
          300: '#76cba7',
          400: '#4ab989',
          500: '#2d9a6c',
          600: '#2D6A4F', // main primary
          700: '#215239',
          800: '#1a3c2a',
          900: '#142e21',
        },
        secondary: {
          50: '#faf6ee',
          100: '#f4ecdc',
          200: '#e9d9b9',
          300: '#ddc695',
          400: '#d2b372',
          500: '#c7a04e',
          600: '#AA8E61', // main secondary
          700: '#80683e',
          800: '#554627',
          900: '#2b2313',
        },
        accent: {
          50: '#fef8ee',
          100: '#fdeeda',
          200: '#fbddb5',
          300: '#f9cb90',
          400: '#f7ba6b',
          500: '#F59E0B', // main accent
          600: '#b8780d',
          700: '#865809',
          800: '#533705',
          900: '#271a02',
        },
        success: {
          500: '#10B981',
        },
        warning: {
          500: '#F59E0B',
        },
        error: {
          500: '#EF4444',
        },
      },
      spacing: {
        '128': '32rem',
        '144': '36rem',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};