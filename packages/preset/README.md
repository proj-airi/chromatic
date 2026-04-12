# `@proj-airi/unocss-preset-chromatic`

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![bundle][bundle-src]][bundle-href]
[![JSDocs][jsdocs-src]][jsdocs-href]
[![License][license-src]][license-href]

```shell
ni -D @proj-airi/unocss-preset-chromatic # from @antfu/ni, can be installed via `npm i -g @antfu/ni`
pnpm i -D @proj-airi/unocss-preset-chromatic
yarn i -D @proj-airi/unocss-preset-chromatic
npm i -D @proj-airi/unocss-preset-chromatic
```

Refer to [README.md](https://github.com/proj-airi/chromatic/blob/main/README.md) for more information.

## Brightness and Saturation Modifiers

Chromatic supports a combined suffix syntax for runtime color tuning:

```txt
<utility>-<color>-<shade>/<opacity>~<saturation>*<brightness>
```

- `/` opacity in percent (UnoCSS standard color opacity, e.g. `/50`)
- `~` saturation/chroma in percent (`100` = unchanged)
- `*` brightness in percent (`100` = unchanged)

Examples:

```html
<div class="bg-primary-500/50~10*115" />
<div class="hover:bg-primary-500/60~80*120" />
<div class="text-primary-600~120" />
<div class="border-primary-400*70" />
```

Notes:

- Modifier order is strict: `/<opacity>~<saturation>*<brightness>`.
- `*` and `~` are optional.
- Supported color utilities default to `bg-*`, `text-*`, `border-*`, `ring-*`, `fill-*`, and `stroke-*`.
- You can customize utility matching via `modifierUtilityPrefixes`.

## License

MIT

[npm-version-src]: https://img.shields.io/npm/v/@proj-airi/unocss-preset-chromatic?style=flat&colorA=080f12&colorB=#ec92ad
[npm-version-href]: https://npmjs.com/package/@proj-airi/unocss-preset-chromatic
[npm-downloads-src]: https://img.shields.io/npm/dm/@proj-airi/unocss-preset-chromatic?style=flat&colorA=080f12&colorB=#ec92ad
[npm-downloads-href]: https://npmjs.com/package/@proj-airi/unocss-preset-chromatic
[bundle-src]: https://img.shields.io/bundlephobia/minzip/@proj-airi/unocss-preset-chromatic?style=flat&colorA=080f12&colorB=#ec92ad&label=minzip
[bundle-href]: https://bundlephobia.com/result?p=@proj-airi/unocss-preset-chromatic
[license-src]: https://img.shields.io/github/license/proj-airi/chromatic.svg?style=flat&colorA=080f12&colorB=#ec92ad
[license-href]: https://github.com/proj-airi/chromatic/blob/main/LICENSE
[jsdocs-src]: https://img.shields.io/badge/jsdocs-reference-080f12?style=flat&colorA=080f12&colorB=#ec92ad
[jsdocs-href]: https://www.jsdocs.io/package/@proj-airi/unocss-preset-chromatic
