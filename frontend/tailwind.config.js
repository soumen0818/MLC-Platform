/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: "#F4F4F5",
          secondary: "#FAFAFA",
        },
        card: {
          DEFAULT: "#ffffff",
        },
        primary: {
          DEFAULT: "#CCFF00",
          foreground: "#000000",
        },
        text: {
          primary: "#0A0A0A",
          secondary: "#52525B",
          muted: "#A1A1AA",
          inverse: "#ffffff"
        },
        border: {
          DEFAULT: "#E4E4E7",
        },
        sidebar: {
          bg: "#0A0A0A",
          border: "#27272a"
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
