<script setup lang="ts">
const { selectedStore, totalRows, previewLimit, mutatingRows } = defineProps<{
  selectedStore: string
  totalRows: number
  previewLimit: number
  mutatingRows: boolean
  rows: PreviewRow[]
}>()

const emits = defineEmits<{
  createRow: []
  updateRow: []
  deleteRow: []
  setEditorByRow: [PreviewRow]
  deletePreviewRow: [PreviewRow]
}>()

const editorState = inject<{
  rowIdInput: Ref<string>
  rowEditorText: Ref<string>
  handleResetEditorWithTemplate: () => void
}>('dbViewerEditor')

if (!editorState)
  throw new Error('dbViewerEditor context not found')

const { rowIdInput, rowEditorText, handleResetEditorWithTemplate } = editorState

function handleFormatRow(value: unknown) {
  if (typeof value === 'string')
    return value

  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value)

  if (value === null)
    return 'null'

  if (typeof value === 'undefined')
    return 'undefined'

  if (value instanceof Blob)
    return JSON.stringify({ __type: 'Blob', size: value.size, mime: value.type }, null, 2)

  try {
    return JSON.stringify(value, (_key, currentValue) => {
      if (currentValue instanceof Blob)
        return { __type: 'Blob', size: currentValue.size, mime: currentValue.type }
      return currentValue
    }, 2)
  }
  catch {
    return String(value)
  }
}
</script>

<template>
  <section border="~ gray-300 1px solid" rounded="~" p="3">
    <div flex="~" items="center" justify="between">
      <div font="medium">
        {{ selectedStore || 'No table selected' }}
      </div>
      <div text="sm" opacity="70">
        Total: {{ totalRows }}
      </div>
    </div>

    <div m="t-2" text="xs" opacity="70">
      Preview: first {{ previewLimit }} rows
    </div>

    <div m="t-3" border="~ gray-300 1px solid" rounded="~" p="3" space="y-2" flex="~ col" gap="2">
      <div font="medium" text="sm">
        Row CRUD
      </div>
      <input
        v-model="rowIdInput" w="full" border="~ gray-300 1px solid" rounded="~" p="x-2 y-1" text="sm"
        placeholder="Row id (for Update/Delete)"
      >
      <textarea
        v-model="rowEditorText" w="full" border="~ gray-300 1px solid" rounded="~" p="2" text="sx" min="h-140px"
        placeholder="Row JSON object"
      />
      <div flex="~ wrap" items="center" gap="2">
        <button database-btn="~" :disabled="mutatingRows || !selectedStore" @click="emits('createRow')">
          {{ mutatingRows ? 'Processing...' : 'Create' }}
        </button>
        <button database-btn="~" :disabled="mutatingRows || !selectedStore" @click="emits('updateRow')">
          {{ mutatingRows ? 'Processing...' : 'Update' }}
        </button>
        <button database-btn="~" :disabled="mutatingRows || !selectedStore" @click="emits('deleteRow')">
          {{ mutatingRows ? 'Processing...' : 'Delete' }}
        </button>
        <button database-btn="~" :disabled="mutatingRows" @click="handleResetEditorWithTemplate">
          Reset Editor
        </button>
      </div>
    </div>

    <div v-if="selectedStore && !rows.length" m="t-3" text="sm" opacity="60">
      No rows in this table.
    </div>

    <ul v-else m="t-3" space="y-2" max="h-70vh" overflow="auto">
      <li v-for="(row, idx) in rows" :key="idx" m="y-2" border="~ gray-300 1px solid" rounded="~" p="2">
        <div flex="~" items="center" justify="between" gap="2" m="b-2">
          <div text="xs" opacity="70" break="all">
            Key: {{ row.keyText }}
          </div>
          <div flex="~" items="center" gap="2">
            <button database-btn="~" :disabled="mutatingRows" @click="emits('setEditorByRow', row)">
              Edit
            </button>
            <button database-btn="~" :disabled="mutatingRows" @click="emits('deletePreviewRow', row)">
              Delete
            </button>
          </div>
        </div>
        <pre whitespace="pre-wrap" break="all" text="xs">{{ handleFormatRow(row.value) }} </pre>
      </li>
    </ul>
  </section>
</template>
