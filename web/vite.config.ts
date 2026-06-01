/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Minimal local typing so the config can read the build-time base without
// pulling in @types/node for the whole project.
declare const process: { env: Record<string, string | undefined> };

const API = "http://localhost:8000";

// Served at the domain root for local dev; the deploy workflow sets VITE_BASE to
// the GitHub Pages project subpath (e.g. "/engineering-capacity-planner/") so all
// assets resolve correctly. import.meta.env.BASE_URL flows from this into engine.ts.
const base = process.env.VITE_BASE || "/";

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    proxy: {
      "/org": API,
      "/teams": API,
      "/groups": API,
      "/health": API,
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
