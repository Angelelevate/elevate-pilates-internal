import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

const reactFiles = {
  files: ['**/*.{js,jsx}'],
  extends: [
    js.configs.recommended,
    reactHooks.configs.flat.recommended,
    reactRefresh.configs.vite,
  ],
  languageOptions: {
    ecmaVersion: 2020,
    globals: globals.browser,
    parserOptions: {
      ecmaVersion: 'latest',
      ecmaFeatures: { jsx: true },
      sourceType: 'module',
    },
  },
  rules: {
    'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    // Standard data-fetching in useEffect triggers false positives vs React 19 purity guidance.
    'react-hooks/set-state-in-effect': 'off',
  },
}

export default defineConfig([
  globalIgnores(['dist']),
  {
    ...reactFiles,
    files: ['**/*.{test,spec}.{js,jsx}'],
    languageOptions: {
      ...reactFiles.languageOptions,
      globals: { ...globals.browser, ...globals.vitest },
    },
  },
  {
    ...reactFiles,
    ignores: ['**/*.{test,spec}.{js,jsx}'],
  },
  {
    files: ['src/contexts/**/*.{js,jsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
