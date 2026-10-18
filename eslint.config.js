import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import perfectionist from 'eslint-plugin-perfectionist';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['.output/**', '.wxt/**', 'coverage/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.webextensions },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    files: ['**/*.tsx'],
    ...jsxA11y.flatConfigs.recommended,
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, perfectionist },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // House style shared with the drplt monorepo.
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'separate-type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      'perfectionist/sort-imports': ['error', { type: 'natural' }],
      'perfectionist/sort-named-exports': ['error', { type: 'natural' }],
      'perfectionist/sort-named-imports': ['error', { type: 'natural' }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // Never build DOM from strings: results contain customer data.
      'no-restricted-properties': [
        'error',
        { property: 'innerHTML', message: 'Use DOM APIs or React; never assign HTML strings.' },
        { property: 'outerHTML', message: 'Use DOM APIs or React; never assign HTML strings.' },
        { property: 'insertAdjacentHTML', message: 'Use DOM APIs or React; never assign HTML strings.' },
      ],
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'test/**'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
  {
    files: ['**/*.js'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ['*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
);
