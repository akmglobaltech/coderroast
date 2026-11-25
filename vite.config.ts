import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// GitHub Pages serves project sites from /<repo>/, so the production build needs
// that prefix while the dev server stays at the root.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/coderroast/" : "/",
  plugins: [react(), tailwindcss()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
}));
