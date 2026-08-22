import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

// Fast lint: no parserOptions.project (type-aware) and no eslint-plugin-import.
// Types are enforced by `tsc --noEmit` in check:* scripts.

const sharedRules = {
  '@typescript-eslint/no-explicit-any': 'off',
  'no-unused-vars': 'off',
  '@typescript-eslint/no-unused-vars': 'off',
  'unused-imports/no-unused-imports': 'warn',
  'unused-imports/no-unused-vars': [
    'warn',
    {
      vars: 'all',
      varsIgnorePattern: '^_',
      args: 'after-used',
      argsIgnorePattern: '^_',
    },
  ],
};

const sourceFiles = [
  'client-next/**/*.{js,jsx,ts,tsx,mjs}',
  'dashboard/**/*.{ts,tsx}',
  'server/src/**/*.{ts,tsx}',
  'server/prisma/**/*.ts',
  'packages/common-ui/src/**/*.{ts,tsx}',
  'packages/common-ui/tsup.config.ts',
  'packages/shared-schemas/**/*.ts',
  'workers/auth-bff/**/*.ts',
  'workers/tenant-router/**/*.{js,mjs}',
];

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/dist/**',
    '**/.next/**',
    '**/.turbo/**',
    '**/.open-next/**',
    '**/.wrangler/**',
    '**/coverage/**',
    '**/uploads/**',
    '**/generated/**',
    'server/prisma/migrations/**',
    'client-next/next-env.d.ts',
  ]),

  {
    files: ['client-next/**/*.{js,jsx,ts,tsx,mjs}'],
    extends: [...nextVitals, ...nextTs],
    rules: {
      // Legacy form clients sync state from effects; refactor separately from lint rollout.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
    },
  },

  {
    files: ['dashboard/**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      'react-refresh/only-export-components': 'warn',
    },
  },

  {
    files: ['server/src/**/*.{ts,tsx}', 'server/prisma/**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      'no-async-promise-executor': 'off',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': false,
          'ts-nocheck': 'allow-with-description',
          minimumDescriptionLength: 3,
        },
      ],
    },
  },

  {
    files: ['packages/common-ui/src/**/*.{ts,tsx}', 'packages/common-ui/tsup.config.ts'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
  },

  {
    files: ['packages/shared-schemas/**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
    },
  },

  {
    files: ['workers/auth-bff/**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.worker,
    },
  },

  {
    files: ['workers/tenant-router/**/*.{js,mjs}'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.worker,
    },
  },

  {
    files: sourceFiles,
    plugins: { 'unused-imports': unusedImports },
    rules: sharedRules,
  },

  eslintConfigPrettier,
]);
