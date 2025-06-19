import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    'index': './src/index.ts',
    'index.node': './src/index.node.ts',
  },
  dts: true,
  unused: true,
  fixedExtension: true,
})
