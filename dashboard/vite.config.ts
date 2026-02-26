import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react(), visualizer({})],
  optimizeDeps: {
    exclude: ["@school/shared-schemas"],
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname, "..")],
    },
    watch: {
      followSymlinks: true,
    },
  },
  resolve: {
    preserveSymlinks: true,
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@school/shared-schemas": path.resolve(__dirname, "../packages/shared-schemas/index.ts"),
    },
  },
});
