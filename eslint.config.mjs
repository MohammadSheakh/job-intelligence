import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import next from '@next/eslint-plugin-next';
import { fileURLToPath } from 'node:url';

// Prettier preserves short inline decorators; require a separate line for reviewability.
const decoratorLines = {
  meta: {
    type: 'layout',
    fixable: 'whitespace',
    schema: [],
    messages: { separateLine: 'Place each decorator and its declaration on separate lines.' },
  },
  create(context) {
    return {
      Decorator(node) {
        const next = context.sourceCode.getTokenAfter(node, { includeComments: true });
        if (next && node.loc.end.line === next.loc.start.line) {
          context.report({
            node,
            messageId: 'separateLine',
            fix: (fixer) => fixer.replaceTextRange([node.range[1], next.range[0]], '\n'),
          });
        }
      },
    };
  },
};

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '.agents/**',
      '.codex/**',
      '.scratch/**',
      'data/**',
      '**/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: globals.node },
    plugins: { '@next/next': next },
    settings: { next: { rootDir: fileURLToPath(new URL('./frontend/', import.meta.url)) } },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrors: 'none', varsIgnorePattern: '^_' },
      ],
    },
  },
  { files: ['backend/test/**/*.ts'], languageOptions: { globals: globals.jest } },
  {
    files: ['frontend/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...next.configs.recommended.rules,
      ...next.configs['core-web-vitals'].rules,
    },
  },
  { files: ['**/*.cjs'], rules: { '@typescript-eslint/no-require-imports': 'off' } },
  {
    plugins: { local: { rules: { 'decorator-lines': decoratorLines } } },
    rules: { 'local/decorator-lines': 'error' },
  },
  prettier,
);
