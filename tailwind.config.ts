import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        desk: {
          bg: "#0b0e11",
          panel: "#12161c",
          elevated: "#1a1f27",
          border: "#2a3140",
          muted: "#8b95a8",
          text: "#e8edf5",
          accent: "#2962ff",
          up: "#26a69a",
          down: "#ef5350",
          warn: "#ffb74d",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["0.65rem", { lineHeight: "0.9rem" }],
      },
    },
  },
  plugins: [],
};

export default config;
