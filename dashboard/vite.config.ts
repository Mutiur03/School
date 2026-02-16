import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react(), visualizer({})],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
