<script setup lang="ts">
import DatabaseHeader from './components/DatabaseHeader.vue'
import DetailPanel from './components/DetailPanel.vue'
import DocumentsPanel from './components/DocumentsPanel.vue'
import FooterConsole from './components/FooterConsole.vue'
import { useDatabaseManagerActions } from './composables/useDatabaseManagerActions'
import { useDatabaseManagerLogger } from './composables/useDatabaseManagerLogger'
import { useDatabaseManagerState } from './composables/useDatabaseManagerState'
import { useOverlayDialog } from './composables/useOverlayDialog'

const state = useDatabaseManagerState()
const logger = useDatabaseManagerLogger()
const dialogs = useOverlayDialog()

const {
  documents,
  selectedDocument,
  items,
  newDocTitle,
  newItemData,
  layoutMode,
  loading,
} = state

const {
  loadDocuments,
  createDocument,
  selectDocument,
  deleteDocument,
  createItem,
  updateItem,
  deleteItem,
} = useDatabaseManagerActions({ state, logger, dialogs })

const panelLayoutClass = computed(() => {
  return layoutMode.value === 'card'
    ? 'grid grid-cols-3 gap-4'
    : 'flex flex-col gap-4'
})

const documentsPanelClass = computed(() => {
  return layoutMode.value === 'card'
    ? 'col-span-1 min-h-0 h-full'
    : 'flex-none h-64'
})

const detailPanelClass = computed(() => {
  return layoutMode.value === 'card'
    ? 'col-span-2 min-h-0 h-full'
    : 'flex-1 min-h-0'
})

onMounted(() => {
  void loadDocuments()
})
</script>

<template>
  <main w="screen" h="screen" flex="~ col" overflow="hidden" bg="#f1f5f9" text="slate-800">
    <DatabaseHeader v-model:layout-mode="layoutMode" />

    <section flex="1" min-h="0" overflow="hidden" p="4">
      <div h="full" min-h="0" :class="panelLayoutClass">
        <DocumentsPanel
          v-model:new-doc-title="newDocTitle"
          :class="documentsPanelClass"
          :documents="documents"
          :selected-document="selectedDocument"
          :loading="loading"
          @create="createDocument"
          @select="selectDocument"
          @delete="deleteDocument"
        />

        <DetailPanel
          v-model:new-item-data="newItemData"
          :class="detailPanelClass"
          :selected-document="selectedDocument"
          :items="items"
          :loading="loading"
          :format-item-data="logger.formatItemData"
          @create-item="createItem"
          @update-item="updateItem"
          @delete-item="deleteItem"
        />
      </div>
    </section>

    <FooterConsole />
  </main>
</template>
