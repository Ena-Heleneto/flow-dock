import type { Ref } from 'vue'
import { ref } from 'vue'

export type DatabaseLayoutMode = 'card' | 'module'

export interface DatabaseDocument {
  _id: string
  title?: string
  [key: string]: unknown
}

export interface DatabaseItem {
  _id: string
  data?: unknown
  [key: string]: unknown
}

export interface DatabaseManagerState {
  documents: Ref<DatabaseDocument[]>
  selectedDocument: Ref<DatabaseDocument | null>
  items: Ref<DatabaseItem[]>
  newDocTitle: Ref<string>
  newItemData: Ref<string>
  layoutMode: Ref<DatabaseLayoutMode>
  loading: Ref<boolean>
}

export function useDatabaseManagerState(): DatabaseManagerState {
  const documents = ref<DatabaseDocument[]>([])
  const selectedDocument = ref<DatabaseDocument | null>(null)
  const items = ref<DatabaseItem[]>([])
  const newDocTitle = ref('')
  const newItemData = ref('')
  const layoutMode = ref<DatabaseLayoutMode>('card')
  const loading = ref(false)

  return {
    documents,
    selectedDocument,
    items,
    newDocTitle,
    newItemData,
    layoutMode,
    loading,
  }
}
