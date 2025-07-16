<script setup lang="ts">
import { useDark, useToggle } from '@vueuse/core'

import GettingStarted from './docs/getting-started.md'

const isDark = useDark()
const toggleDark = useToggle(isDark)
</script>

<template>
  <div>
    <header sticky left-0 top-0 z-10 w-full px-4 pb-0 pt-2>
      <div bg="neutral-100/80 dark:neutral-800/50" mx-auto max-w-screen-lg flex gap-2 rounded-xl p-4 backdrop-blur-md>
        <h1 flex-1 text-2xl>
          Chromatic Theme System
        </h1>
        <div flex flex-row items-center gap-2>
          <button text-lg outline-none @click="() => toggleDark()">
            <div v-if="isDark" i-solar:moon-stars-bold-duotone />
            <div v-else i-solar:sun-bold />
          </button>
          <a href="https://github.com/proj-airi/chromatic" outline-none>
            <div i-simple-icons:github />
          </a>
        </div>
      </div>
    </header>
    <div mx-auto max-w-screen-lg flex flex-col gap-2 px-4 pb-4 pt-0>
      <div>
        <GettingStarted />
      </div>
    </div>
  </div>
</template>
