import Shiki from '@shikijs/markdown-it'
import Vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import Markdown from 'unplugin-vue-markdown/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    Vue({
      include: [/\.vue$/, /\.md$/],
    }),
    Markdown({
      markdownItUses: [
        await Shiki({
          themes: {
            light: 'catppuccin-latte',
            dark: 'catppuccin-mocha',
          },
        }),
      ],
    }),
    UnoCSS(),
  ],
})
