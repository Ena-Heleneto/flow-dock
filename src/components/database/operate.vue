<script setup lang="ts">
const { initializingStores, loadingStores, loadingRows } = defineProps<{
  initializingStores: boolean
  loadingStores: boolean
  loadingRows: boolean
  selectedStore: string
}>()

const emits = defineEmits<{ initializeAllStores: [], refreshStores: [], refreshCurrentStore: [] }>()
</script>

<template>
  <div m="t-4" flex="~" items="center" gap="2">
    <button :disabled="initializingStores" @click="emits('initializeAllStores')">
      {{ initializingStores ? 'Initializing tables...' : 'Initialize Tables' }}
    </button>

    <button :disabled="loadingStores" @click="emits('refreshStores')">
      {{ loadingStores ? 'Refreshing tables...' : 'Refresh Tables' }}
    </button>

    <button :disabled="loadingRows || !selectedStore" @click="emits('refreshCurrentStore')">
      {{ loadingRows ? 'Refreshing rows...' : 'Refresh Rows' }}
    </button>
  </div>
</template>
