/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{js,jsx,ts,tsx}',
    './app/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#7C3AED',
        secondary: '#EC4899',
        accent: '#3B82F6',
      },
    },
  },
  plugins: [],
};

