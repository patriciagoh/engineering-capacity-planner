import type { Config } from "tailwindcss";
import matchaOat from "matcha-oat-design-system/tailwind-preset";

export default {
  presets: [matchaOat],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
} satisfies Config;
