// Use the bundled FlatCompat helper from ESLint itself to avoid an extra dependency
const { FlatCompat } = require('eslint/use-at-your-own-risk');

// Bridge legacy .eslintrc config to ESLint's flat config format for v9+ compatibility
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
