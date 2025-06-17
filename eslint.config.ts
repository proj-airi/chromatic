import antfu from '@antfu/eslint-config'

export default await antfu(
  {
    unocss: true,
    vue: true,
    toml: false,
    ignores: [
      'dist/**',
      'cspell.config.yaml',
      'cspell.config.yml',
    ],
    rules: {
      'perfectionist/sort-imports': [
        'error',
        {
          groups: [
            'type-import',
            'type-internal',
            ['type-parent', 'type-sibling', 'type-index'],
            ['value-builtin', 'value-external'],
            'value-internal',
            ['value-parent', 'value-sibling', 'value-index'],
            'style',
          ],
          newlinesBetween: 'always',
        },
      ],
    },
  },
  {
    files: ['**/tsconfig.json'],
    rules: {
      'jsonc/sort-keys': 'off',
    },
  },
)
