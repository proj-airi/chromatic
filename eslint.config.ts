import antfu from '@antfu/eslint-config'
import unocss from '@unocss/eslint-config/flat'
import { fileURLToPath } from 'node:url'

export default await antfu(
  {
    unocss: false,
    vue: true,
    toml: false,
    ignores: [
      'dist/**',
      'cspell.config.yaml',
      'cspell.config.yml',
    ],
    rules: {
      'vue/prefer-separate-static-class': 'off',
      'perfectionist/sort-imports': [
      'error',
      {
        groups: [
          'type-builtin',
          'type-import',
          'type-internal',
          ['type-parent', 'type-sibling', 'type-index'],
          'default-value-builtin',
          'named-value-builtin',
          'value-builtin',
          'default-value-external',
          'named-value-external',
          'value-external',
          'default-value-internal',
          'named-value-internal',
          'value-internal',
          ['default-value-parent', 'default-value-sibling', 'default-value-index'],
          ['named-value-parent', 'named-value-sibling', 'named-value-index'],
          ['wildcard-value-parent', 'wildcard-value-sibling', 'wildcard-value-index'],
          ['value-parent', 'value-sibling', 'value-index'],
          'side-effect',
          'style',
        ],
        newlinesBetween: 1,
      },
    ],
    },
  },
  {
    files: [
      '**/tsconfig.json',
      '**/tsconfig.app.json',
      '**/tsconfig.node.json',
    ],
    rules: {
      'jsonc/sort-keys': 'off',
    },
  },
  // Thanks to
  // https://github.com/unocss/unocss/issues/2603#issuecomment-2806940007
  {
    ...unocss,
    files: ['playground/**/*'],
    name: 'internal/unocss',
    settings: {
      unocss: {
        configPath: fileURLToPath(new URL('./playground/uno.config.ts', import.meta.url)),
      },
    },
  },
)
