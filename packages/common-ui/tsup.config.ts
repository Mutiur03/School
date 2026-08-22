import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/lib/blob.ts"],
  format: ["esm"],
  dts: false,
  sourcemap: true,
  clean: true,
  target: "es2022",
  external: ["react", "react-dom", "react-router-dom"],
});