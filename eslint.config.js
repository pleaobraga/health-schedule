import storybook from 'eslint-plugin-storybook'

import js from '@eslint/js'
import i18nextPlugin from 'eslint-plugin-i18next'
import importPlugin from 'eslint-plugin-import-x'
import reactPlugin from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { globalIgnores } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  [
    globalIgnores(['dist', 'dist-e2e', 'playwright-report', 'storybook-static', 'test-results']),
    {
      files: ['**/*.{ts,tsx}'],
      extends: [
        js.configs.recommended,
        tseslint.configs.recommended,
        reactHooks.configs.flat['recommended-latest'],
        reactRefresh.configs.vite
      ],
      plugins: {
        react: reactPlugin,
        import: importPlugin,
        i18next: i18nextPlugin
      },
      languageOptions: {
        ecmaVersion: 2020,
        globals: globals.browser
      },
      rules: {
        'react-hooks/set-state-in-effect': 'off',
        '@typescript-eslint/no-unused-vars': [
          'warn',
          { vars: 'all', args: 'after-used', ignoreRestSiblings: true }
        ],
        '@typescript-eslint/consistent-type-imports': [
          'error',
          { prefer: 'type-imports' }
        ],
        'no-console': ['warn', { allow: ['warn', 'error'] }],
        'no-debugger': 'error',
        'react/jsx-no-useless-fragment': 'warn',
        'semi': ['error', 'never'],
        'import/first': 'error',
        'import/no-duplicates': 'error',
        'import/no-default-export': 'error',
        'import/order': [
          'error',
          {
            groups: [
              'builtin',
              'external',
              'internal',
              ['parent', 'sibling', 'index'],
              'type'
            ],
            alphabetize: { order: 'asc', caseInsensitive: true },
            'newlines-between': 'always'
          }
        ],
        'i18next/no-literal-string': [
          'error',
          {
            mode: 'jsx-only',
            'jsx-attributes': {
              include: ['title', 'aria-label', 'placeholder', 'alt']
            }
          }
        ]
      }
    },
    {
      files: ['src/**/*.tsx'],
      ignores: ['src/components/ui/date-picker.tsx'],
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            selector: "JSXAttribute[name.name='type'][value.value=/^(date|datetime-local)$/]",
            message: 'Use DatePicker from src/components/ui/date-picker (shadcn) for date fields.'
          }
        ]
      }
    },
    {
      files: [
        '**/*.stories.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/*.test.{ts,tsx}',
        '*.config.{ts,js,mjs}',
        '.storybook/**/*.{ts,tsx}',
        'src/router/**/*.{ts,tsx}'
      ],
      rules: {
        'import/no-default-export': 'off',
        'no-console': 'off',
        'i18next/no-literal-string': 'off'
      }
    }
  ],
  storybook.configs['flat/recommended']
)