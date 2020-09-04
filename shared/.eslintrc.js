const baseConfig = require('../.eslintrc.js')
module.exports = {
  extends: '../.eslintrc.js',
  parserOptions: {
    ...baseConfig.parserOptions,
    project: [__dirname + '/tsconfig.json', __dirname + '/src/testing/tsconfig.json'],
  },
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: [
          ...baseConfig.rules['no-restricted-imports'][1].paths,
          {
            name: 'react-router-dom',
            importNames: ['Link'],
            message:
              "Use the src/shared/components/Link component instead of react-router-dom's Link. Reason: Shared code runs on platforms that don't use react-router (such as in the browser extension).",
          },
        ],
      },
    ],
  },
  overrides: [
    ...baseConfig.overrides,
    {
      files: ['src/graphql/schema.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 0,
        'jsdoc/check-indentation': 0,
        'jsdoc/newline-after-description': 0,
        'unicorn/prevent-abbreviations': 0,
      },
    },
  ],
}
