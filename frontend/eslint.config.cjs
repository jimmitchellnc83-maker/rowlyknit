// Use the built-in FlatCompat helper shipped with ESLint to avoid an extra dependency
const { FlatCompat } = require('eslint/use-at-your-own-risk');

// Bridge legacy .eslintrc settings into ESLint flat config for v9+ runtimes
const compat = new FlatCompat({
  baseDirectory: __dirname,
  resolvePluginsRelativeTo: __dirname,
});

module.exports = [
  {
    ignores: ['dist', 'node_modules'],
  },
  ...compat.extend(['./.eslintrc.json']),
];
