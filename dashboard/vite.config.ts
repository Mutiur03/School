import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react(), visualizer({})],
  optimizeDeps: {
    exclude: ["@school/shared-schemas", "@mutiur03/observa-web"],
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname, "..")],
    },
    watch: {
      followSymlinks: true,
    },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
  resolve: {
    preserveSymlinks: true,
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
