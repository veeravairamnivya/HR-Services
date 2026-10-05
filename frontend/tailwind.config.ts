import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ABRAH brand: deep navy with gold accents (sampled from the logo and approved screens).
        navy: {
          50: "#f2f5fa",
          100: "#e3e9f3",
          200: "#c5d1e4",
          300: "#9bb0cf",
          400: "#6a87b3",
          500: "#456694",
          600: "#2f4e7a",
          700: "#233d63",
          800: "#1a3052",
          900: "#0c2340",
          950: "#081a31",
        },
        gold: {
          50: "#fff9e8",
          100: "#fdf0c4",
          200: "#fae08a",
          300: "#f6cc4f",
          400: "#f0bb25",
          500: "#e6a812",
          600: "#c8890b",
          700: "#9f660d",
          800: "#835112",
          900: "#6f4314",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(16,24,40,.04), 0 4px 16px -4px rgba(16,24,40,.08)",
        glow: "0 10px 30px -12px rgba(12,35,64,.55)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "none" } },
        "slide-in": { from: { transform: "translateX(100%)" }, to: { transform: "none" } },
      },
      animation: {
        "fade-in": "fade-in .2s ease-out",
        "slide-in": "slide-in .25s cubic-bezier(.2,.8,.2,1)",
      },
    },
  },
  plugins: [],
} satisfies Config;
