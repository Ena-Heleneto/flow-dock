<script setup lang="ts">
const dbName = defineModel<string>('dbName', { default: '' })
</script>

<template>
  <div text="center">
    <div text="lg" font="semibold">
      Database Viewer
    </div>
    <div opacity="70" text="sm" m="t-1">
      DB: {{ dbName }}
    </div>
  </div>
</template>
