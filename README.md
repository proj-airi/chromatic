# `chromatic`

[[Try it](https://proj-airi-chromatic.netlify.app/)]

> [!NOTE]
>
> This project is part of (and also associate to) the [Project AIRI](https://github.com/moeru-ai/airi), we aim to build a LLM-driven VTuber like [Neuro-sama](https://www.youtube.com/@Neurosama) (subscribe if you didn't!) if you are interested in, please do give it a try on [live demo](https://airi.moeru.ai).
>
> We use both DuckDB WASM and PGLite for the backbone implementation for memory layer as embedded databases that capable of doing vector search to power up bionic memory systems for AI VTuber and cyber livings. We shared a lot in our [DevLogs](https://airi.moeru.ai/docs/blog/devlog-20250305/) in [DevLog @ 2025.04.06](https://airi.moeru.ai/docs/blog/devlog-20250406/), please read it if you are interested in!
>
> Who are we?
>
> We are a group of currently non-funded talented people made up with computer scientists, experts in multi-modal fields, designers, product managers, and popular open source contributors who loves the goal of where we are heading now.

🎨 Readability enhanced, clean, nice looking colors palette we used across our [Project AIRI](https://github.com/moeru-ai/airi) projects!
You could think of it as a alternative of https://www.radix-ui.com/colors/custom

## Getting Started

```shell
ni -D @proj-airi/unocss-preset-chromatic # from @antfu/ni, can be installed via `npm i -g @antfu/ni`
pnpm i -D @proj-airi/unocss-preset-chromatic
yarn i -D @proj-airi/unocss-preset-chromatic
npm i -D @proj-airi/unocss-preset-chromatic
```

```ts
// unocss.config.ts
import { presetChromatic } from '@proj-airi/unocss-preset-chromatic'
import { defineConfig } from 'unocss'

export default defineConfig({
  presets: [
    presetChromatic(),
  ],
})
```

### Development

```bash
pnpm dev
```

### Build

```bash
pnpm build
```

## More UnoCSS and UI stuff we made for [Project AIRI](https://github.com/moeru-ai/airi)

- [proj-airi/lobe-icons](https://github.com/proj-airi/lobe-icons): Iconify port of @lobehub's wonderful lobe-icons assets

## Acknowledgements

- All the contributors of [Project AIRI](https://github.com/moeru-ai/airi) who tried to improve the custom color theme system.

## License

MIT
