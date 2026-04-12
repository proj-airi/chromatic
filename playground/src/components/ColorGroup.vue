<script setup lang="ts" generic="T extends string | number">
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui'
import { nextTick } from 'vue'

const props = withDefaults(defineProps<{
  options: T[]
  ariaLabel: string
  wrap?: boolean
  itemClass?: (option: T, checked: boolean) => string | string[]
}>(), {
  wrap: true,
  itemClass: undefined,
})

const modelValue = defineModel<T>({ required: true })

function setValue(option: T) {
  modelValue.value = option
}

function focusOption(option: T) {
  nextTick(() => {
    const selector = `[data-color-option="${String(option)}"]`
    const element = document.querySelector(selector)
    if (element instanceof HTMLElement)
      element.focus()
  })
}

function move(current: T, delta: number) {
  const index = props.options.findIndex(option => option === current)
  if (index < 0 || props.options.length === 0)
    return

  if (props.wrap) {
    const nextIndex = (index + delta + props.options.length) % props.options.length
    const nextValue = props.options[nextIndex]
    setValue(nextValue)
    focusOption(nextValue)
    return
  }

  const nextIndex = Math.min(props.options.length - 1, Math.max(0, index + delta))
  const nextValue = props.options[nextIndex]
  setValue(nextValue)
  focusOption(nextValue)
}

function onKeydown(event: KeyboardEvent, option: T) {
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    event.preventDefault()
    move(option, 1)
    return
  }

  if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    event.preventDefault()
    move(option, -1)
    return
  }

  if (event.key === 'Home') {
    event.preventDefault()
    const first = props.options[0]
    if (first !== undefined) {
      setValue(first)
      focusOption(first)
    }
    return
  }

  if (event.key === 'End') {
    event.preventDefault()
    const last = props.options[props.options.length - 1]
    if (last !== undefined) {
      setValue(last)
      focusOption(last)
    }
    return
  }

  if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
    event.preventDefault()
    setValue(option)
  }
}
</script>

<template>
  <RadioGroupRoot
    v-model="modelValue"
    :aria-label="props.ariaLabel"
    class="flex gap-2 justify-between"
    w-full px="0 sm:8" py-2 overflow-x-scroll
  >
    <RadioGroupItem
      v-for="option in props.options"
      :key="String(option)"
      :value="option"
      :data-color-option="String(option)"
      h-12 w-12 shrink-0 cursor-pointer rounded-xl border-none
      :class="props.itemClass?.(option, modelValue === option)"
      :aria-label="`${props.ariaLabel} ${option}`"
      :title="`${option}`"
      @click="setValue(option)"
      @keydown="onKeydown($event, option)"
    >
      <slot name="option" :option="option" :checked="modelValue === option" />
    </RadioGroupItem>
  </RadioGroupRoot>
</template>
