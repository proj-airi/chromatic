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
