<script setup lang="ts">
import ItemsList from './ItemsList.vue'

interface DatabaseDocumentLite {
  _id: string
  title?: string
  [key: string]: unknown
}

interface DatabaseItemLite {
  _id: string
  data?: unknown
  [key: string]: unknown
}

interface Props {
  selectedDocument: DatabaseDocumentLite | null
  items: DatabaseItemLite[]
  newItemData: string
  loading: boolean
  formatItemData: (data: unknown) => string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:newItemData', value: string): void
  (e: 'createItem'): void
  (e: 'updateItem', item: DatabaseItemLite): void
  (e: 'deleteItem', item: DatabaseItemLite): void
}>()

const newItemModel = computed({
  get: () => props.newItemData,
  set: (value: string) => emit('update:newItemData', value),
})
</script>

<template>
  <section min-h="0" rounded="lg" border="1 solid #e2e8f0" bg="white" p="3" flex="~ col">
    <h2 text="base" font="medium">
      Document Details
    </h2>

    <div v-if="!props.selectedDocument" m="t-3" text="sm slate-500">
      Select a document to view items.
    </div>

    <template v-else>
      <div m="t-3" text="sm" flex="~ col" gap="1">
        <div>ID: {{ props.selectedDocument._id }}</div>
        <div>Title: {{ props.selectedDocument.title }}</div>
      </div>

      <div m="t-3" flex="~ col 1" min-h="0">
        <h3 text="base" font="medium">
          Items
        </h3>

        <div m="t-2" flex="~" gap="2">
          <input
            v-model="newItemModel"
            flex="1"
            rounded="md"
            border="1 solid #cbd5e1"
            p="x-2 y-1"
            text="sm"
            placeholder="New item text"
          >
          <button rounded="md" bg="green-600" text="white sm" p="x-3 y-1" :disabled="props.loading" @click="emit('createItem')">
            Add
          </button>
        </div>

        <div m="t-3" flex="1" min-h="0">
          <ItemsList
            :items="props.items"
            :format-item-data="props.formatItemData"
            @update-item="emit('updateItem', $event)"
            @delete-item="emit('deleteItem', $event)"
          />
        </div>
      </div>
    </template>
  </section>
</template>
