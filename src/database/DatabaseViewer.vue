<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

const dbName = 'flow-dock'
const previewLimit = 50

const loadingStores = ref(false)
const loadingRows = ref(false)
const errorMessage = ref('')

const stores = ref<string[]>([])
const selectedStore = ref('')
const totalRows = ref(0)
const rows = ref<unknown[]>([])

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(dbName)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error(`Failed to open DB: ${dbName}`))
  })
}

function readPreviewRows(store: IDBObjectStore, limit: number) {
  return new Promise<unknown[]>((resolve, reject) => {
    const records: unknown[] = []
    const request = store.openCursor()

    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor || records.length >= limit) {
        resolve(records)
        return
      }

      records.push(cursor.value)
      cursor.continue()
    }

    request.onerror = () => reject(request.error ?? new Error('Failed to read preview rows'))
  })
}

function formatRow(row: unknown) {
  try {
    return JSON.stringify(row, null, 2)
  }
  catch {
    return String(row)
  }
}

async function refreshStores() {
  loadingStores.value = true
  errorMessage.value = ''

  try {
    const database = await openDatabase()
    const names = Array.from(database.objectStoreNames)
    stores.value = names

    if (!names.length) {
      selectedStore.value = ''
      totalRows.value = 0
      rows.value = []
    }
    else if (!names.includes(selectedStore.value)) {
      selectedStore.value = names[0] ?? ''
    }

    database.close()
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
  finally {
    loadingStores.value = false
  }
}

async function refreshCurrentStore() {
  if (!selectedStore.value) {
    totalRows.value = 0
    rows.value = []
    return
  }

  loadingRows.value = true
  errorMessage.value = ''

  try {
    const database = await openDatabase()
    const transaction = database.transaction(selectedStore.value, 'readonly')
    const store = transaction.objectStore(selectedStore.value)

    const [count, preview] = await Promise.all([
      requestToPromise<number>(store.count()),
      readPreviewRows(store, previewLimit),
    ])

    totalRows.value = count
    rows.value = preview
    database.close()
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
  finally {
    loadingRows.value = false
  }
}

watch(selectedStore, async () => {
  await refreshCurrentStore()
})

onMounted(async () => {
  await refreshStores()
  await refreshCurrentStore()
})
</script>

<template>
  <main class="px-4 py-6 text-gray-700 dark:text-gray-200">
    <div class="text-center">
      <div class="text-lg font-semibold">
        Database Viewer
      </div>
      <div class="opacity-70 text-sm mt-1">
        DB: {{ dbName }}
      </div>
    </div>

    <div class="mt-4 flex items-center gap-2">
      <button class="btn" :disabled="loadingStores" @click="refreshStores">
        {{ loadingStores ? 'Refreshing tables...' : 'Refresh Tables' }}
      </button>
      <button class="btn" :disabled="loadingRows || !selectedStore" @click="refreshCurrentStore">
        {{ loadingRows ? 'Refreshing rows...' : 'Refresh Rows' }}
      </button>
    </div>

    <div v-if="errorMessage" class="mt-3 text-sm text-red-600">
      {{ errorMessage }}
    </div>

    <div class="mt-4 grid grid-cols-[220px_1fr] gap-4">
      <section class="border border-gray-300 rounded p-2">
        <div class="font-medium mb-2">
          Tables ({{ stores.length }})
        </div>
        <div v-if="!stores.length" class="text-sm opacity-60">
          No object stores found.
        </div>
        <ul v-else class="space-y-1 max-h-[70vh] overflow-auto">
          <li v-for="name in stores" :key="name">
            <button
              class="w-full text-left px-2 py-1 rounded border border-gray-300"
              :class="selectedStore === name ? 'font-semibold' : ''"
              @click="selectedStore = name"
            >
              {{ name }}
            </button>
          </li>
        </ul>
      </section>

      <section class="border border-gray-300 rounded p-3">
        <div class="flex items-center justify-between">
          <div class="font-medium">
            {{ selectedStore || 'No table selected' }}
          </div>
          <div class="text-sm opacity-70">
            Total: {{ totalRows }}
          </div>
        </div>

        <div class="mt-2 text-xs opacity-70">
          Preview: first {{ previewLimit }} rows
        </div>

        <div v-if="selectedStore && !rows.length" class="mt-3 text-sm opacity-60">
          No rows in this table.
        </div>

        <ul v-else class="mt-3 space-y-2 max-h-[70vh] overflow-auto">
          <li v-for="(row, idx) in rows" :key="idx" m="y-2" class="border border-gray-300 rounded p-2">
            <pre class="whitespace-pre-wrap break-all text-xs">{{ formatRow(row) }}</pre>
          </li>
        </ul>
      </section>
    </div>
  </main>
</template>
