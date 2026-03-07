import js from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import globals from "globals";

export default [
  {
    // Ignore generated / third-party directories
    ignores: [
      "node_modules/**",
      "dist/**",
      "prisma/migrations/**",
      "public/**",
      "uploads/**",
    ],
  },
  js.configs.recommended,
  {
    plugins: {
      import: importPlugin,
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
    settings: {
      "import/resolver": {
        node: {
          extensions: [".js", ".mjs"],
        },
        typescript: {
          alwaysTryTypes: true,
        },
      },
      "import/parsers": {
        espree: [".js", ".mjs"],
      },
    },
    rules: {
      // ── Catch missing / wrong imports ────────────────────────────────────
      // Named import that the source module doesn't export
      "import/named": "error",
      // Default import when no default export exists
      "import/default": "error",
      // Namespace import used with a property that doesn't exist
      "import/namespace": "warn",
      // Import path that cannot be resolved at all
      "import/no-unresolved": ["error", { commonjs: false, amd: false }],
      // Duplicate exports in the same file
      "import/export": "error",

      // ── Catch "used before import" / forgotten imports ───────────────────
      // Variable is used but was never declared/imported
      "no-undef": "error",
      // Variable was imported but never used (helps spot typo-imports)
      "no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
    },
  },
];
