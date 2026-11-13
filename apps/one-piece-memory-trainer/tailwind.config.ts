import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: { 950: "#07090f", 900: "#0c111b", 800: "#131a28", 700: "#1c2536", 600: "#2a3550" },
        straw: { 300: "#ffe08a", 400: "#ffd257", 500: "#f5b81c", 600: "#d99a00" },
        sea: { 400: "#4cc3ff", 500: "#1fa6f0" },
        blood: { 400: "#ff6b6b", 500: "#ef4444" },
      },
      fontFamily: { display: ["ui-sans-serif", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};
export default config;
