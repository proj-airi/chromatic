<script setup lang="ts">
import { useDark, useToggle } from '@vueuse/core'

const isDark = useDark()
const toggleDark = useToggle(isDark)

const navItems = [
  { label: 'Docs', to: '/' },
  { label: 'Chroma lab', to: '/lab' },
]
</script>

<template>
  <div>
    <header sticky left-0 top-0 z-10 w-full px-4 pb-0 pt-2>
      <div bg="neutral-100/80 dark:neutral-800/50" mx-auto max-w-screen-lg flex items-center gap-4 rounded-xl p-4 backdrop-blur-md>
        <h1 text-2xl>
          Chromatic Theme System
        </h1>
        <nav flex flex-1 items-center gap-1 text-sm>
          <RouterLink
            v-for="item in navItems" :key="item.to" :to="item.to"
            rounded-md px-2 py-1 transition-colors
            class="hover:bg-neutral-200/80 dark:hover:bg-neutral-700/60"
            active-class="!bg-primary-200/70 dark:!bg-primary-800/60"
            exact-active-class="font-semibold"
          >
            {{ item.label }}
          </RouterLink>
        </nav>
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
    <RouterView />
  </div>
</template>
