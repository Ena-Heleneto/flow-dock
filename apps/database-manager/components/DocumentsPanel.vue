<script setup lang="ts">
interface DatabaseDocumentLite {
  _id: string
  title?: string
  [key: string]: unknown
}

interface Props {
  documents: DatabaseDocumentLite[]
  selectedDocument: DatabaseDocumentLite | null
  newDocTitle: string
  loading: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:newDocTitle', value: string): void
  (e: 'create'): void
  (e: 'select', doc: DatabaseDocumentLite): void
  (e: 'delete', doc: DatabaseDocumentLite): void
}>()

const titleModel = computed({
  get: () => props.newDocTitle,
  set: (value: string) => emit('update:newDocTitle', value),
})

function isSelected(doc: DatabaseDocumentLite) {
  return !!props.selectedDocument?._id && props.selectedDocument._id === doc._id
}
</script>

<template>
  <section min-h="0" rounded="lg" border="1 solid #e2e8f0" bg="white" p="3" flex="~ col">
    <h2 text="base" font="medium">
      Documents
    </h2>

    <div m="t-2" flex="~" gap="2">
      <input
        v-model="titleModel"
        flex="1"
        rounded="md"
        border="1 solid #cbd5e1"
        p="x-2 y-1"
        text="sm"
        placeholder="New document title"
      >
      <button rounded="md" bg="blue-600" text="white sm" p="x-3 y-1" :disabled="props.loading" @click="emit('create')">
        Create
      </button>
    </div>

    <ul m="t-3" flex="~ col 1" min-h="0" overflow="auto" gap="2" text="sm">
      <li
        v-for="doc in props.documents"
        :key="doc._id"
        rounded="md"
        border="1 solid #e2e8f0"
        p="x-2 y-1"
        flex="~"
        justify="between"
        items="center"
        gap="2"
        :class="isSelected(doc) ? 'bg-sky-50 border-sky-200' : 'bg-white'"
      >
        <button
          type="button"
          text="left"
          flex="1"
          truncate
          :class="isSelected(doc) ? 'text-sky-700' : 'text-slate-700 hover:text-slate-900'"
          @click="emit('select', doc)"
        >
          {{ doc.title || doc._id }}
        </button>

        <button type="button" text="xs red-600" @click="emit('delete', doc)">
          Delete
        </button>
      </li>

      <li v-if="!props.documents.length" text="sm slate-500" p="y-2 x-1">
        No documents yet.
      </li>
    </ul>
  </section>
</template>
