/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Baloo 2"', 'system-ui', 'sans-serif'],
        body: ['"Nunito"', 'system-ui', 'sans-serif'],
      },
      colors: {
        cone: { 50: '#fff8ef', 100: '#fdebd3', 200: '#f6d3a5', 300: '#e9b06d', 400: '#d58c3f', 500: '#b86c26', 600: '#8f511c', 700: '#663917', 800: '#41250f', 900: '#24140a' },
        berry: { 300: '#ff9ccf', 400: '#ff6fb5', 500: '#f0479a', 600: '#c92c7a' },
        mint: { 300: '#9ff3d4', 400: '#5fe3b5', 500: '#2fc595' },
        night: { 700: '#1d1a2b', 800: '#15121f', 900: '#0d0b14' },
      },
      boxShadow: { card: '0 10px 30px -10px rgba(0,0,0,.6)' },
    },
  },
  plugins: [],
};
