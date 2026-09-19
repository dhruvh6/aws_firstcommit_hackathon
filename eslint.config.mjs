// Flat ESLint config. Owner: M4 (docs/08-TEAM-ROLES.md § 3).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/.vite/**', 'infra/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Plain JS/ESM tooling scripts (e.g. scripts/build-lambda.mjs). Without
    // this block they get js.configs.recommended with no globals declared, so
    // `no-undef` fires on `console` and `process` - a config gap, not a bug in
    // the script. Keep the TS rules off these: typescript-eslint's recommended
    // set targets TS files and expects the TS parser.
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'off',
      eqeqeq: ['error', 'smart'],
    },
  },
);
