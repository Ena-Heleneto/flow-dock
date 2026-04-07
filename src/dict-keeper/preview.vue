<script lang="ts" setup>
import DictKeeperDrawer from './components/drawer/index.vue'

const drawerOpen = defineModel<boolean>('visible', { default: false })
</script>

<template>
  <DictKeeperDrawer v-model:open="drawerOpen" />
</template>
