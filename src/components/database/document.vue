<script lang="ts" setup>
const { stores } = defineProps<{ stores: string[] }>()
const selectedStore = defineModel<string>('selectedStore', { default: '' })
</script>

<template>
  <section border="~ gray-200/80 dark:gray-700/70" rounded="xl" bg="white/70 dark:gray-900/40" p="3">
    <div font="semibold" m="b-2">
      Tables ({{ stores.length }})
    </div>
    <div v-if="!stores.length" text="sm" opacity="65" p="y-2">
      No object stores found.
    </div>
    <ul v-else space="y-2" max="h-70vh" overflow="auto" p="r-1">
      <li v-for="name in stores" :key="name" m="y-2">
        <button
          w="full" text="left" p="x-3 y-2" rounded="lg" border="~ gray-200/80 dark:gray-700/70"
          bg="white/80 dark:gray-900/60" transition="colors"
          :class="selectedStore === name
            ? 'text-teal-700 dark:text-teal-300 border-teal-400/70 dark:border-teal-500/70 font-semibold'
            : 'hover:bg-gray-100/80 dark:hover:bg-gray-800/70'"
          @click="selectedStore = name"
        >
          {{ name }}
        </button>
      </li>
    </ul>
  </section>
</template>
