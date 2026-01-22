<script setup lang="ts">
import { useDraggable, useToggle } from '@vueuse/core'
import { computed, onMounted, ref } from 'vue'
import 'uno.css'

const [show, toggle] = useToggle(false)

const dragTarget = ref<HTMLElement | null>(null)
const { x, y, style, isDragging } = useDraggable(dragTarget, {
  initialValue: { x: 0, y: 0 },
  capture: false,
  preventDefault: false,
  stopPropagation: false,
})

const dragStyle = computed(() => [
  style.value,
  {
    cursor: isDragging.value ? 'grabbing' : 'grab',
    touchAction: 'none',
  },
])

onMounted(() => {
  const margin = 20
  const size = 40
  x.value = window.innerWidth - margin - size
  y.value = window.innerHeight - margin - size
})
</script>

<template>
  <div
    ref="dragTarget"
    :style="dragStyle"
    class="fixed z-100 flex font-sans select-none leading-1em"
    items="center"
  >
    <button
      class="flex w-10 h-10 rounded-full shadow cursor-pointer border-none"
      bg="teal-600 hover:teal-700"
      @click.stop="toggle()"
    >
      <pixelarticons-power class="block m-auto text-white text-lg" />
    </button>
    <div
      v-show="show"
      class="bg-white text-gray-800 rounded-lg shadow w-max h-min"
      p="x-4 y-2"
      m="y-auto r-2"
      transition="opacity duration-300"
      :class="show ? 'opacity-100' : 'opacity-0'"
    >
      <h1 class="text-lg">
        Vitesse WebExt
      </h1>
      <SharedSubtitle />
    </div>
  </div>
</template>
