<script setup lang="ts">
const dbName = ref('flow-dock-dev')

const {
  initializingStores,
  loadingStores,
  loadingRows,
  selectedStore,
  successMessage,
  errorMessage,
  stores,
  totalRows,
  previewLimit,
  mutatingRows,
  rows,
  setEditorByRow,
  handleCreateRow,
  handleUpdateRow,
  handleDeleteRow,
  handleDeletePreviewRow,
  handleClearCurrentStore,
  handleInitializeAllStores,
  handleRefreshStores,
  handleRefreshCurrentStore,
  bindViewerLifecycle,
} = useDbViewer(dbName)

bindViewerLifecycle()
</script>

<template>
  <div p="x-4 y-6" text="gray-700 dark:gray-200" max="w-7xl" m="x-auto">
    <DatabaseHeader v-model:db-name="dbName" />
    <DatabaseOperate
      :initializing-stores="initializingStores" :loading-stores="loadingStores"
      :loading-rows="loadingRows" :mutating-rows="mutatingRows" :selected-store="selectedStore" @initialize-all-stores="handleInitializeAllStores"
      @refresh-stores="handleRefreshStores" @refresh-current-store="handleRefreshCurrentStore"
      @clear-current-store="handleClearCurrentStore"
    />
    <DatabaseMessage :success-message="successMessage" :error-message="errorMessage" />

    <div m="t-4" grid="~ cols-[240px_1fr]" gap="4">
      <DatabaseDocument v-model:selected-store="selectedStore" :stores="stores" />
      <DatabaseContent
        :selected-store="selectedStore" :total-rows="totalRows" :preview-limit="previewLimit"
        :mutating-rows="mutatingRows" :rows="rows"
        @create-row="handleCreateRow" @update-row="handleUpdateRow" @delete-row="handleDeleteRow"
        @set-editor-by-row="setEditorByRow" @delete-preview-row="handleDeletePreviewRow"
      />
    </div>
  </div>
</template>
