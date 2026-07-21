import { defineConfig } from 'tsdown'

export default defineConfig({
  dts: true,
  entry: {
    'index': './src/index.ts',
    'index.node': './src/index.node.ts',
  },
  fixedExtension: true,
  unused: true,
})
