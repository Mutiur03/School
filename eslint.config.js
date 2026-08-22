import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import importPlugin from 'eslint-plugin-import';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const tsProject = (relativeDir) => ({
  parserOptions: {
    project: [path.join(relativeDir, 'tsconfig.json')],
    tsconfigRootDir: rootDir,
  },
});

const sharedLintRules = {
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

const lintedSourceFiles = [
  'client-next/**/*.{js,jsx,ts,tsx,mjs}',
  'dashboard/**/*.{ts,tsx}',
  'server/src/**/*.{ts,tsx}',
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
      ...tsProject('dashboard'),
    },
    rules: {
      'react-refresh/only-export-components': 'warn',
    },
  },

  {
    files: ['server/prisma/**/*.ts', 'packages/common-ui/tsup.config.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
  },

  {
    files: ['server/src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    plugins: { import: importPlugin },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
      ...tsProject('server'),
    },
    settings: {
      'import/resolver': {
        node: { extensions: ['.js', '.mjs', '.ts'] },
        typescript: {
          alwaysTryTypes: true,
          project: path.join(rootDir, 'server/tsconfig.json'),
        },
      },
    },
    rules: {
      'import/named': 'error',
      'import/default': 'error',
      'import/namespace': 'warn',
      'import/no-unresolved': ['error', { commonjs: false, amd: false }],
      'import/export': 'error',
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
    files: ['packages/common-ui/src/**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      ...tsProject('packages/common-ui'),
    },
  },

  {
    files: ['packages/shared-schemas/**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      ...tsProject('packages/shared-schemas'),
    },
  },

  {
    files: ['workers/auth-bff/**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.worker,
      ...tsProject('workers/auth-bff'),
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
    files: lintedSourceFiles,
    plugins: { 'unused-imports': unusedImports },
    rules: sharedLintRules,
  },

  eslintConfigPrettier,
]);
