import type { DatabaseManagerLogger } from './useDatabaseManagerLogger'
import type { DatabaseDocument, DatabaseItem, DatabaseManagerState } from './useDatabaseManagerState'
import type { OverlayDialog } from './useOverlayDialog'
import { request } from '~/shared/composables/useRouterRequest'

interface UseDatabaseManagerActionsOptions {
  state: DatabaseManagerState
  logger: DatabaseManagerLogger
  dialogs: OverlayDialog
}

export function useDatabaseManagerActions({ state, logger, dialogs }: UseDatabaseManagerActionsOptions) {
  const {
    documents,
    selectedDocument,
    items,
    newDocTitle,
    newItemData,
    loading,
  } = state

  const {
    appendStartLog,
    appendSuccessLog,
    appendErrorLog,
  } = logger

  const {
    showInputDialog,
    showConfirmDialog,
  } = dialogs

  async function loadDocuments() {
    loading.value = true
    appendStartLog('document.read')

    try {
      const res = await request<{ items?: DatabaseDocument[] }>('/database-manager/document.read', {
        method: 'GET',
        meta: { module: 'database-manager', page: 'database-manager' },
      })
      documents.value = res.ok ? (res.data.items ?? []) : []
      appendSuccessLog('document.read', res)
    }
    catch (error) {
      documents.value = []
      appendErrorLog('document.read', error)
    }
    finally {
      loading.value = false
    }
  }

  async function createDocument() {
    const title = newDocTitle.value.trim()
    if (!title)
      return

    loading.value = true
    appendStartLog('document.create', { title })

    try {
      const res = await request('/database-manager/document.create', {
        method: 'POST',
        body: { title },
        meta: { module: 'database-manager', page: 'database-manager' },
      })

      appendSuccessLog('document.create', res)
      newDocTitle.value = ''
      await loadDocuments()
    }
    catch (error) {
      appendErrorLog('document.create', error)
    }
    finally {
      loading.value = false
    }
  }

  async function selectDocument(doc: DatabaseDocument) {
    selectedDocument.value = doc
    appendStartLog('document.select', { id: doc._id, title: doc.title ?? '' })
    appendSuccessLog('document.select', { id: doc._id, title: doc.title ?? '' })
    await loadItems()
  }

  async function deleteDocument(doc: DatabaseDocument) {
    const confirmed = await showConfirmDialog('Delete document?')
    if (!confirmed)
      return

    loading.value = true
    appendStartLog('document.delete', { id: doc._id })

    try {
      const res = await request('/database-manager/document.delete', {
        method: 'DELETE',
        body: { id: doc._id },
        meta: { module: 'database-manager', page: 'database-manager' },
      })

      appendSuccessLog('document.delete', res)
      selectedDocument.value = null
      await loadDocuments()
    }
    catch (error) {
      appendErrorLog('document.delete', error)
    }
    finally {
      loading.value = false
    }
  }

  async function loadItems() {
    if (!selectedDocument.value) {
      items.value = []
      return
    }

    loading.value = true
    appendStartLog('item.list', { documentId: selectedDocument.value._id })

    try {
      const res = await request<{ items?: DatabaseItem[] }>('/database-manager/item.list', {
        method: 'GET',
        body: { documentId: selectedDocument.value._id },
        meta: { module: 'database-manager', page: 'database-manager' },
      })
      items.value = res.ok ? (res.data.items ?? []) : []
      appendSuccessLog('item.list', res)
    }
    catch (error) {
      items.value = []
      appendErrorLog('item.list', error)
    }
    finally {
      loading.value = false
    }
  }

  async function createItem() {
    if (!selectedDocument.value)
      return

    loading.value = true
    appendStartLog('item.create', {
      documentId: selectedDocument.value._id,
      text: newItemData.value,
    })

    try {
      const res = await request('/database-manager/item.create', {
        method: 'POST',
        body: {
          documentId: selectedDocument.value._id,
          data: { text: newItemData.value },
        },
        meta: { module: 'database-manager', page: 'database-manager' },
      })

      appendSuccessLog('item.create', res)
      newItemData.value = ''
      await loadItems()
    }
    catch (error) {
      appendErrorLog('item.create', error)
    }
    finally {
      loading.value = false
    }
  }

  async function updateItem(item: DatabaseItem) {
    const newVal = await showInputDialog('Edit item data JSON', JSON.stringify(item.data))
    if (newVal === null)
      return

    let parsed: unknown
    try {
      parsed = JSON.parse(newVal)
    }
    catch {
      parsed = newVal
    }

    loading.value = true
    appendStartLog('item.update', {
      id: item._id,
      data: parsed,
    })

    try {
      const res = await request('/database-manager/item.update', {
        method: 'PUT',
        body: { id: item._id, data: parsed },
        meta: { module: 'database-manager', page: 'database-manager' },
      })

      appendSuccessLog('item.update', res)
      await loadItems()
    }
    catch (error) {
      appendErrorLog('item.update', error)
    }
    finally {
      loading.value = false
    }
  }

  async function deleteItem(item: DatabaseItem) {
    const confirmed = await showConfirmDialog('Delete item?')
    if (!confirmed)
      return

    loading.value = true
    appendStartLog('item.delete', { id: item._id })

    try {
      const res = await request('/database-manager/item.delete', {
        method: 'DELETE',
        body: { id: item._id },
        meta: { module: 'database-manager', page: 'database-manager' },
      })

      appendSuccessLog('item.delete', res)
      await loadItems()
    }
    catch (error) {
      appendErrorLog('item.delete', error)
    }
    finally {
      loading.value = false
    }
  }

  return {
    loadDocuments,
    createDocument,
    selectDocument,
    deleteDocument,
    loadItems,
    createItem,
    updateItem,
    deleteItem,
  }
}
