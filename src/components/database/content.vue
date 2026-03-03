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
  <section border="~ gray-200/80 dark:gray-700/70" rounded="xl" bg="white/70 dark:gray-900/40" p="4">
    <div flex="~" items="center" justify="between" gap="3">
      <div font="semibold" text="base">
        {{ selectedStore || 'No table selected' }}
      </div>
      <div text="sm" opacity="70" whitespace="nowrap">
        Total: {{ totalRows }}
      </div>
    </div>

    <div m="t-2" text="xs" opacity="70">
      Preview: first {{ previewLimit }} rows
    </div>

    <div m="t-4" border="~ gray-200/80 dark:gray-700/70" rounded="xl" bg="white/70 dark:gray-900/50" p="4" space="y-2" flex="~ col" gap="2">
      <div font="medium" text="sm">
        Row CRUD
      </div>
      <input
        v-model="rowIdInput" w="full" border="~ gray-200/90 dark:gray-700/80" rounded="lg" p="x-3 y-2" text="sm"
        bg="white/80 dark:gray-900/60"
        placeholder="Row id (for Update/Delete)"
      >
      <textarea
        v-model="rowEditorText" w="full" border="~ gray-200/90 dark:gray-700/80" rounded="lg" p="3" text="sx" min="h-140px"
        bg="white/80 dark:gray-900/60" font="mono"
        placeholder="Row JSON object"
      />
      <div flex="~ wrap" items="center" gap="2" m="t-1">
        <button database-btn="~" :disabled="mutatingRows || !selectedStore" @click="emits('createRow')">
          {{ mutatingRows ? 'Processing...' : 'Create' }}
        </button>
        <button database-btn-secondary="~" :disabled="mutatingRows || !selectedStore" @click="emits('updateRow')">
          {{ mutatingRows ? 'Processing...' : 'Update' }}
        </button>
        <button database-btn-danger="~" :disabled="mutatingRows || !selectedStore" @click="emits('deleteRow')">
          {{ mutatingRows ? 'Processing...' : 'Delete' }}
        </button>
        <button database-btn-secondary="~" :disabled="mutatingRows" @click="handleResetEditorWithTemplate">
          Reset Editor
        </button>
      </div>
    </div>

    <div v-if="selectedStore && !rows.length" m="t-4" text="sm" opacity="65" border="~ dashed gray-300/80 dark:gray-700/70" rounded="lg" p="3">
      No rows in this table.
    </div>

    <ul v-else m="t-4" space="y-2" max="h-70vh" overflow="auto" p="r-1">
      <li v-for="(row, idx) in rows" :key="idx" border="~ gray-200/90 dark:gray-700/70" rounded="lg" bg="white/85 dark:gray-900/65" p="3">
        <div flex="~" items="center" justify="between" gap="2" m="b-2">
          <div text="xs" opacity="70" break="all">
            Key: {{ row.keyText }}
          </div>
          <div flex="~" items="center" gap="2">
            <button database-btn-secondary="~" :disabled="mutatingRows" @click="emits('setEditorByRow', row)">
              Edit
            </button>
            <button database-btn-danger="~" :disabled="mutatingRows" @click="emits('deletePreviewRow', row)">
              Delete
            </button>
          </div>
        </div>
        <pre whitespace="pre-wrap" break="all" text="xs" bg="gray-50/80 dark:gray-800/70" border="~ gray-200/70 dark:gray-700/70" rounded="md" p="2">{{ handleFormatRow(row.value) }} </pre>
      </li>
    </ul>
  </section>
</template>
