/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'olive': {
          400: '#E8715F',
          500: '#D85A4A',
          600: '#C84D3D',
          700: '#B84030',
          900: '#5C2018',
        },
        'gray-primary': '#202020',
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', 'sans-serif'],
        'mono': ['Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}