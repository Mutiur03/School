import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  loader: {
    ".png": "dataurl",
    ".jpg": "dataurl",
    ".jpeg": "dataurl",
    ".svg": "dataurl",
  },
  external: [
    "react",
    "react-dom",
    "react-router-dom",
    "lucide-react",
    "framer-motion",
    "axios",
    "@tanstack/react-query",
    "@school/common-ui",
  ],
});
