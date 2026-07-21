import { defineConfig } from 'bumpp'

export default defineConfig({
  commit: 'release: v%s',
  push: false,
  recursive: true,
  sign: true,
})
