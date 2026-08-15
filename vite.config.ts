import { defineConfig } from "vite";
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
});
