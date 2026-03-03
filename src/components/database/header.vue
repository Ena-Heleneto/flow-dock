<script setup lang="ts">
const dbName = defineModel<string>('dbName', { default: '' })
</script>

<template>
  <div text="center" border="~ gray-200/70 dark:gray-700/60" rounded="xl" bg="white/70 dark:gray-900/40" p="x-4 y-3">
    <div text="xl" font="semibold">
      Database Viewer
    </div>
    <div opacity="70" text="sm" m="t-1">
      DB: {{ dbName }}
    </div>
  </div>
</template>
