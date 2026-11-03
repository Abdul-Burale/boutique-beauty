/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: { colors: { ink: '#25221f', cream: '#f7f2eb', rose: '#d98f80', clay: '#a45f50' }, fontFamily: { display: ['Georgia', 'serif'] } } },
  plugins: [],
}
