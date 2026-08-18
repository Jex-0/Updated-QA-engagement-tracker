import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Freebuff requires HMR to remain disabled — do not add `hmr: true` or an `hmr: {}` object.
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    host: "0.0.0.0",
    port: Number(process.env.PORT) || 5173,
    hmr: false,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/**/*.ts", "src/lib/**/*.tsx"],
      exclude: ["src/lib/types.ts", "src/**/*.test.ts", "src/**/*.test.tsx"],
    },
  },
});
