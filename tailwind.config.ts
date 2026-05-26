import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      padding: {
        safe: "env(safe-area-inset-top)",
      },
      keyframes: {
        "presence-pulse": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.6", transform: "scale(1.15)" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "glow": {
          "0%, 100%": { boxShadow: "0 0 6px 2px rgba(16, 185, 129, 0.3)" },
          "50%": { boxShadow: "0 0 12px 4px rgba(16, 185, 129, 0.5)" },
        },
      },
      animation: {
        "presence-pulse": "presence-pulse 2s ease-in-out infinite",
        "fade-in": "fade-in 0.4s ease-out both",
        "glow": "glow 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
