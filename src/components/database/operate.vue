<script setup lang="ts">
const { initializingStores, loadingStores, loadingRows, mutatingRows, selectedStore } = defineProps<{
  initializingStores: boolean
  loadingStores: boolean
  loadingRows: boolean
  mutatingRows: boolean
  selectedStore: string
}>()

const emits = defineEmits<{ initializeAllStores: [], refreshStores: [], refreshCurrentStore: [], clearCurrentStore: [] }>()

const clearConfirming = ref(false)
let clearConfirmTimer: ReturnType<typeof setTimeout> | undefined

function resetClearConfirmState() {
  clearConfirming.value = false
  if (clearConfirmTimer)
    clearTimeout(clearConfirmTimer)
  clearConfirmTimer = undefined
}

function handleClearCurrentStore() {
  if (!selectedStore)
    return

  if (clearConfirming.value) {
    resetClearConfirmState()
    emits('clearCurrentStore')
    return
  }

  clearConfirming.value = true
  clearConfirmTimer = setTimeout(() => {
    clearConfirming.value = false
    clearConfirmTimer = undefined
  }, 5000)
}

watch(() => selectedStore, resetClearConfirmState)
watch(() => mutatingRows, value => value && resetClearConfirmState())
onBeforeUnmount(resetClearConfirmState)
</script>

<template>
  <div m="t-4" border="~ gray-200/70 dark:gray-700/60" rounded="xl" bg="white/70 dark:gray-900/40" p="3" flex="~ wrap" items="center" gap="2">
    <button database-btn="~" :disabled="initializingStores || mutatingRows" @click="emits('initializeAllStores')">
      {{ initializingStores ? 'Initializing tables...' : 'Initialize Tables' }}
    </button>

    <button database-btn-secondary="~" :disabled="loadingStores || mutatingRows" @click="emits('refreshStores')">
      {{ loadingStores ? 'Refreshing tables...' : 'Refresh Tables' }}
    </button>

    <button database-btn-secondary="~" :disabled="loadingRows || !selectedStore || mutatingRows" @click="emits('refreshCurrentStore')">
      {{ loadingRows ? 'Refreshing rows...' : 'Refresh Rows' }}
    </button>

    <button database-btn-danger="~" :disabled="!selectedStore || mutatingRows || loadingRows" @click="handleClearCurrentStore">
      {{ mutatingRows ? 'Clearing...' : clearConfirming ? 'Click again to confirm' : 'Clear Table' }}
    </button>
  </div>
</template>
