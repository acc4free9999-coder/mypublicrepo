/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        win: '#16a34a',
        loss: '#dc2626',
      },
    },
  },
  plugins: [],
};
