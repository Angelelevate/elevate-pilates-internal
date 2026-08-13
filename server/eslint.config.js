import js from '@eslint/js'
import globals from 'globals'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['node_modules']),
  {
    files: ['**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.node },
      sourceType: 'module',
    },
    rules: {
      // Allow deliberately-unused bindings when they are named to say so: a `_`-prefixed
      // placeholder (unimplemented stub params) or a key destructured purely to omit it
      // from a rest spread. Without this the rule flags intent as if it were an oversight,
      // which is how the lint ended up permanently red and stopped being read.
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
    },
  },
])
