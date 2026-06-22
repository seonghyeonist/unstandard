import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          accent: "#C54434",
          ink: "#202433",
          surface: "#F7F3ED",
          line: "#D7D0C8",
          success: "#2E7D5B",
          warn: "#B26A00",
          danger: "#B33A3A"
        }
      },
      borderRadius: {
        card: "1rem",
        panel: "1.25rem"
      },
      boxShadow: {
        soft: "0 20px 60px rgba(32, 36, 51, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
