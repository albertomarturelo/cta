import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['**/dist/**', '**/*.config.js', '**/*.config.ts'] },
  tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // cta-core never prints: output belongs to the surfaces (CONVENTIONS).
    files: ['packages/core/src/**/*.ts'],
    rules: { 'no-console': 'error' },
  },
  {
    // The main barrel stays embeddable: Node built-ins and Playwright only
    // behind the `./node` subpath (ADR-003).
    files: ['packages/core/src/**/*.ts'],
    ignores: ['packages/core/src/node.ts', 'packages/core/src/node/**', '**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(node:|playwright)',
              message: 'Node and Playwright belong behind the ./node subpath (ADR-003).',
            },
          ],
        },
      ],
    },
  },
);
