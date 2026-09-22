// ESLint ringan untuk mobile (SM-01).
// Sengaja TIDAK extend '@react-native' karena config bawaannya pin
// eslint-plugin-prettier (prettier v2) + @typescript-eslint v5 yang konflik
// dengan versi hoisted monorepo (prettier v3 + @typescript-eslint v8).
// Format tetap via prettier CLI (`npm run format`).
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  env: {
    es6: true,
    node: true,
    jest: true,
  },
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  ignorePatterns: ['node_modules/', 'android/', 'ios/'],
  overrides: [
    {
      files: ['*.js'],
      rules: {
        '@typescript-eslint/no-require-imports': 'off',
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
  ],
  rules: {},
};
