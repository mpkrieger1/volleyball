/* eslint-env node */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  settings: { react: { version: '18' } },
  env: { browser: true, node: true, es2022: true },
  rules: {
    'react/react-in-jsx-scope': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-restricted-syntax': [
      'error',
      {
        selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
        message: 'Use the seeded RNG from @vcd/shared/rng — Math.random breaks determinism (CLAUDE.md §Determinism).',
      },
    ],
  },
  overrides: [
    {
      // Workspace source trees: forbid reaching into another workspace via relative paths.
      files: ['shared/src/**', 'main/src/**', 'workers/src/**', 'app/src/**'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: [
                  '**/shared/src/**',
                  '**/main/src/**',
                  '**/workers/src/**',
                  '**/app/src/**',
                ],
                message:
                  'Cross-workspace imports must use the package name (e.g., "@vcd/shared"). Relative paths into another workspace break at runtime.',
              },
            ],
          },
        ],
      },
    },
  ],
  ignorePatterns: [
    'node_modules/',
    '**/dist/',
    'release/',
    'resources/',
    'coverage/',
    'tests/playwright-report/',
    'tests/test-results/',
    '*.cjs',
  ],
};
