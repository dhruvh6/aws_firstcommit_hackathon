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
    // Playwright driver scripts are Node files that also contain browser code:
    // the callbacks handed to page.evaluate() and addInitScript() run inside the
    // page, so they legitimately reference document and window. Give this
    // directory both environments rather than littering the scripts with
    // eslint-disable comments.
    files: ['demo/**/*.{js,mjs,cjs,mts}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: { '@typescript-eslint/no-unused-expressions': 'off' },
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
