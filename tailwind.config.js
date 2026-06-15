/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cadejo: {
          50:  '#fdf7ed',
          100: '#faebd2',
          200: '#f4d4a0',
          300: '#edb966',
          400: '#e69d3a',
          500: '#d97f1e',
          600: '#c06317',
          700: '#9f4916',
          800: '#823c19',
          900: '#6c3318',
        },
      },
    },
  },
  plugins: [],
}
