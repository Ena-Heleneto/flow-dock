<script lang="ts" setup>
const { stores } = defineProps<{ stores: string[] }>()
const selectedStore = defineModel<string>('selectedStore', { default: '' })
</script>

<template>
  <section border="~ gray-300 1px solid" rounded="~" p="2">
    <div font="medium" m="b-2">
      Tables ({{ stores.length }})
    </div>
    <div v-if="!stores.length" text="sm" opacity="60">
      No object stores found.
    </div>
    <ul v-else space="y-1" max="h-70vh" overflow="auto">
      <li v-for="name in stores" :key="name" m="y-2">
        <button
          w="full" text="left" p="x-2 y-1" rounded="~" border="~ gray-300 1px solid"
          :font="selectedStore === name ? 'medium' : 'normal'" @click="selectedStore = name"
        >
          {{ name }}
        </button>
      </li>
    </ul>
  </section>
</template>
