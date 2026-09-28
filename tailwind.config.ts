import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Avec Pay brand, sampled from the logo.
        brand: {
          yellow: "#EFE14C",
          "yellow-dark": "#D6C82F",
          ink: "#1B1E25",
          "ink-soft": "#2A2E38",
        },
      },
    },
  },
  plugins: [],
};

export default config;
