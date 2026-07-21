import { defineConfig } from 'tsdown'

export default defineConfig({
  dts: true,
  entry: {
    index: './src/index.ts',
  },
  fixedExtension: true,
  unused: true,
})
