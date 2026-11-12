/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0b1018',
        panel: '#121a25',
        line: '#243141',
        accent: '#4f8cff',
      },
    },
  },
  plugins: [],
};
