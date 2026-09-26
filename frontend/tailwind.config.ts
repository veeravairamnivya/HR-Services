import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(16,24,40,.04), 0 4px 16px -4px rgba(16,24,40,.08)",
        glow: "0 10px 30px -10px rgba(99,102,241,.55)",
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
