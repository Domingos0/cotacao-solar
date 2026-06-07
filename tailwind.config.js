/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        weg: {
          blue: '#003087',
          'blue-mid': '#005CA9',
          'blue-light': '#0078C8',
          orange: '#E87722',
          'orange-dark': '#C85F0A',
          gray: '#F4F6F8',
          'gray-mid': '#E0E4E8',
          dark: '#1A1A2E',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
