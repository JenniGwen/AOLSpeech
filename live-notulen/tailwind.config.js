import defaultTheme from "tailwindcss/defaultTheme";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ['"Plus Jakarta Sans"', ...defaultTheme.fontFamily.sans] },
      colors: {
        brand: { 50: "#f2f1fe", 100: "#e6e4fd", 200: "#cfcbfb", 400: "#8f86ee", 500: "#6d63e3", 600: "#5c51d4", 700: "#4a40b3" },
        ink: { DEFAULT: "#1f2a44", soft: "#2c3a5c" },
        navy: { 700: "#2f3170", 800: "#25275a", 900: "#1d1e47", 950: "#18193b" },
      },
      boxShadow: { card: "0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.04)" },
    },
  },
  plugins: [],
};
