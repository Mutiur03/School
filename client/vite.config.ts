import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@school/client-ui": path.resolve(__dirname, "../packages/client-ui/src/index.ts"),
      "@school/common-ui": path.resolve(__dirname, "../packages/common-ui/src/index.ts"),
      "@school/shared-schemas": path.resolve(__dirname, "../packages/shared-schemas/index.ts"),
    },
  }
});
