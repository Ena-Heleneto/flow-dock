<script setup lang="ts">
const dbName = 'flow-dock-dev'
const previewLimit = 50

const loadingStores = ref(false)
const loadingRows = ref(false)
const initializingStores = ref(false)
const mutatingRows = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const stores = ref<string[]>([])
const selectedStore = ref('')
const totalRows = ref(0)
const rowIdInput = ref('')
const rowEditorText = ref(`{
  "id": ""
}`)

interface PreviewRow { key: unknown, keyText: string, value: unknown }

const rows = ref<PreviewRow[]>([])

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

/**
 * 打开 IndexedDB 数据库
 * @async
 * @function openDatabase
 * @returns {Promise<IDBDatabase>} 返回一个 Promise，成功时解析为打开的 IDBDatabase 实例
 * @throws {Error} 当数据库打开失败时，拒绝并返回错误对象或相关错误信息
 * @description
 * 使用 IndexedDB API 打开指定名称的数据库。
 * 如果打开成功，返回数据库连接对象；
 * 如果打开失败，返回错误信息，包括数据库名称。
 */
function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(dbName)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error(`Failed to open DB: ${dbName}`))
  })
}

/**
 * 向浏览器扩展发送消息
 *
 * 通过浏览器运行时API向扩展程序发送消息，并将响应转换为指定的泛型类型。
 * 如果消息发送失败或运行时API不可用，函数将返回null。
 *
 * @template T - 响应数据的类型，默认为unknown
 * @param {Record<string, unknown>} message - 要发送的消息对象
 * @returns {Promise<T | null>} 返回扩展程序的响应，如果发送失败则返回null
 */
async function sendDbViewerMessage<T = unknown>(message: Record<string, unknown>) {
  const sendMessage = browser?.runtime?.sendMessage
  if (typeof sendMessage !== 'function')
    return null

  try {
    return await sendMessage(message) as T
  }
  catch {
    return null
  }
}

/**
 * 从 IndexedDB 对象存储中读取预览行数据
 *
 * @param {IDBObjectStore} store - IndexedDB 对象存储实例
 * @param {number} limit - 最多读取的行数限制
 * @returns {Promise<PreviewRow[]>} 返回预览行数组的 Promise
 *
 * @description
 * 该函数通过打开游标遍历存储中的数据，将每条记录转换为 PreviewRow 对象，
 * 包含原始键、字符串化的键和值。当达到指定的限制数量或游标遍历完毕时停止读取。
 *
 * @throws {Error} 当游标请求失败时拒绝 Promise 并抛出错误
 */
function readPreviewRows(store: IDBObjectStore, limit: number) {
  return new Promise<PreviewRow[]>((resolve, reject) => {
    const records: PreviewRow[] = []
    const request = store.openCursor()

    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor || records.length >= limit) {
        resolve(records)
        return
      }

      records.push({ key: cursor.primaryKey, keyText: keyToString(cursor.primaryKey), value: cursor.value })
      cursor.continue()
    }

    request.onerror = () => reject(request.error ?? new Error('Failed to read preview rows'))
  })
}

/**
 * 等待 IndexedDB 事务完成
 * @param {IDBTransaction} transaction - IndexedDB 事务对象
 * @returns {Promise<void>} 返回一个 Promise，当事务完成时 resolve，失败或中止时 reject
 * @throws {Error} 当事务出错时抛出错误，错误信息为事务的 error 或默认错误提示
 */
function waitTransaction(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
  })
}

function keyToString(key: unknown) {
  if (typeof key === 'string' || typeof key === 'number' || typeof key === 'bigint')
    return String(key)

  if (key instanceof Date)
    return key.toISOString()

  return JSON.stringify(key)
}

function normalizePreviewRows(remoteRows: unknown[]) {
  return remoteRows.map((item, index): PreviewRow => {
    if (
      item
      && typeof item === 'object'
      && 'key' in item
      && 'value' in item
    ) {
      const preview = item as { key: unknown, value: unknown }
      return {
        key: preview.key,
        keyText: keyToString(preview.key),
        value: preview.value,
      }
    }

    const valueObject = item as { id?: IDBValidKey }
    return {
      key: valueObject?.id ?? index,
      keyText: keyToString(valueObject?.id ?? index),
      value: item,
    }
  })
}

function resetEditorWithTemplate() {
  rowEditorText.value = `{
  "id": "${rowIdInput.value.trim()}"
}`
}

function setEditorByRow(row: PreviewRow) {
  rowIdInput.value = row.keyText
  try {
    rowEditorText.value = JSON.stringify(row.value, null, 2)
  }
  catch {
    rowEditorText.value = String(row.value)
  }
}

function parseEditorObject() {
  let parsed: unknown

  try {
    parsed = JSON.parse(rowEditorText.value)
  }
  catch {
    throw new Error('Row JSON is invalid')
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new Error('Row JSON must be an object')

  return parsed as Record<string, unknown>
}

async function runStoreWrite(action: (store: IDBObjectStore) => Promise<void>) {
  if (!selectedStore.value)
    throw new Error('Please select a table first')

  const database = await openDatabase()

  try {
    const transaction = database.transaction(selectedStore.value, 'readwrite')
    const store = transaction.objectStore(selectedStore.value)

    await action(store)
    await waitTransaction(transaction)
  }
  finally {
    database.close()
  }
}

async function createRow() {
  mutatingRows.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const payload = parseEditorObject()
    const id = rowIdInput.value.trim()

    if (!payload.id && id)
      payload.id = id

    if (typeof payload.id !== 'string' || !payload.id.trim())
      throw new Error('Create requires an `id` field')

    await runStoreWrite(async (store) => {
      await requestToPromise(store.add(payload))
    })

    rowIdInput.value = payload.id
    successMessage.value = 'Row created successfully'
    await refreshCurrentStore()
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
  finally {
    mutatingRows.value = false
  }
}

async function updateRow() {
  mutatingRows.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const targetId = rowIdInput.value.trim()
    if (!targetId)
      throw new Error('Update requires a row id')

    const patch = parseEditorObject()

    await runStoreWrite(async (store) => {
      const existing = await requestToPromise(store.get(targetId))
      if (!existing || typeof existing !== 'object')
        throw new Error(`Row not found: ${targetId}`)

      const updated = {
        ...(existing as Record<string, unknown>),
        ...patch,
        id: targetId,
      }

      await requestToPromise(store.put(updated))
    })

    successMessage.value = 'Row updated successfully'
    await refreshCurrentStore()
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
  finally {
    mutatingRows.value = false
  }
}

async function deleteRow() {
  mutatingRows.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const targetId = rowIdInput.value.trim()
    if (!targetId)
      throw new Error('Delete requires a row id')

    await runStoreWrite(async (store) => {
      await requestToPromise(store.delete(targetId))
    })

    successMessage.value = 'Row deleted successfully'
    await refreshCurrentStore()
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
  finally {
    mutatingRows.value = false
  }
}

async function deletePreviewRow(row: PreviewRow) {
  rowIdInput.value = row.keyText
  await deleteRow()
}

function formatKvValue(value: unknown) {
  if (typeof value === 'string')
    return value

  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value)

  if (value === null)
    return 'null'

  if (typeof value === 'undefined')
    return 'undefined'

  try {
    return JSON.stringify(value, null, 2)
  }
  catch {
    return String(value)
  }
}

function formatRow(row: unknown) {
  if (selectedStore.value === 'kv_configs' && row && typeof row === 'object') {
    const kvRow = row as Partial<KvConfigRecord>
    const readable = {
      key: kvRow.id,
      value: formatKvValue(kvRow.value),
      createdAt: kvRow.createdAt,
      updatedAt: kvRow.updatedAt,
      deletedAt: kvRow.deletedAt,
    }

    try {
      return JSON.stringify(readable, null, 2)
    }
    catch {
      return String(readable)
    }
  }

  try {
    return JSON.stringify(row, null, 2)
  }
  catch {
    return String(row)
  }
}

async function initializeAllStores() {
  initializingStores.value = true
  errorMessage.value = ''

  try {
    const remote = await sendDbViewerMessage<{ ok?: boolean, error?: string }>({
      type: 'db-viewer/initialize',
      dbName,
    })

    if (remote?.ok === false)
      throw new Error(remote.error || 'Failed to initialize stores in background')

    if (!remote) {
      await Promise.all([
        pagesSchema().countPages(),
        screenshotsSchema().countScreenshots(),
        screenshotLinksSchema().countScreenshotLinks(),
        clustersSchema().countClusters(),
        componentsSchema().countComponents(),
        bundleSchema().countBundles(),
        bundleComponentsSchema().countBundleComponents(),
        pageBundlesSchema().countPageBundles(),
        pageComponentsSchema().countPageComponents(),
        kvConfigsSchema().countConfigs(),
        clusterLinksSchema().countClusterLinks(),
      ])
    }

    await refreshStores()
    await refreshCurrentStore()
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
  finally {
    initializingStores.value = false
  }
}

async function refreshStores() {
  loadingStores.value = true
  errorMessage.value = ''

  try {
    const remote = await sendDbViewerMessage<{ ok?: boolean, stores?: string[], error?: string }>({
      type: 'db-viewer/stores',
      dbName,
    })

    if (remote?.ok === false)
      throw new Error(remote.error || 'Failed to load stores from background')

    const names = remote?.ok
      ? (remote.stores ?? [])
      : await (async () => {
        const database = await openDatabase()
        const localNames = Array.from(database.objectStoreNames)
        database.close()
        return localNames
      })()

    stores.value = names

    if (!names.length) {
      selectedStore.value = ''
      totalRows.value = 0
      rows.value = []
    }
    else if (!names.includes(selectedStore.value)) {
      selectedStore.value = names[0] ?? ''
    }
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
    const remote = await sendDbViewerMessage<{ ok?: boolean, total?: number, rows?: unknown[], error?: string }>({
      type: 'db-viewer/rows',
      dbName,
      storeName: selectedStore.value,
      limit: previewLimit,
    })

    const [count, preview] = remote?.ok
      ? [remote.total ?? 0, normalizePreviewRows(remote.rows ?? [])]
      : await (async () => {
        const database = await openDatabase()
        const transaction = database.transaction(selectedStore.value, 'readonly')
        const store = transaction.objectStore(selectedStore.value)

        const localResult = await Promise.all([
          requestToPromise<number>(store.count()),
          readPreviewRows(store, previewLimit),
        ])

        database.close()
        return localResult
      })()

    totalRows.value = count
    rows.value = preview
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
  finally {
    loadingRows.value = false
  }
}

watch(selectedStore, async () => {
  errorMessage.value = ''
  successMessage.value = ''
  rowIdInput.value = ''
  resetEditorWithTemplate()
  await refreshCurrentStore()
})

onMounted(async () => {
  await initializeAllStores()
  await refreshStores()
  await refreshCurrentStore()
  resetEditorWithTemplate()
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
      <button class="btn" :disabled="initializingStores" @click="initializeAllStores">
        {{ initializingStores ? 'Initializing tables...' : 'Initialize Tables' }}
      </button>
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
    <div v-if="successMessage" class="mt-3 text-sm text-green-600">
      {{ successMessage }}
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
          <li v-for="name in stores" :key="name" m="y-2">
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

        <div class="mt-3 border border-gray-300 rounded p-3 space-y-2">
          <div class="font-medium text-sm">
            Row CRUD
          </div>
          <input
            v-model="rowIdInput"
            class="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            placeholder="Row id (for Update/Delete)"
          >
          <textarea
            v-model="rowEditorText"
            class="w-full border border-gray-300 rounded p-2 text-xs min-h-[140px]"
            placeholder="Row JSON object"
          />
          <div class="flex items-center gap-2 flex-wrap">
            <button class="btn" :disabled="mutatingRows || !selectedStore" @click="createRow">
              {{ mutatingRows ? 'Processing...' : 'Create' }}
            </button>
            <button class="btn" :disabled="mutatingRows || !selectedStore" @click="updateRow">
              {{ mutatingRows ? 'Processing...' : 'Update' }}
            </button>
            <button class="btn" :disabled="mutatingRows || !selectedStore" @click="deleteRow">
              {{ mutatingRows ? 'Processing...' : 'Delete' }}
            </button>
            <button class="btn" :disabled="mutatingRows" @click="resetEditorWithTemplate">
              Reset Editor
            </button>
          </div>
        </div>

        <div v-if="selectedStore && !rows.length" class="mt-3 text-sm opacity-60">
          No rows in this table.
        </div>

        <ul v-else class="mt-3 space-y-2 max-h-[70vh] overflow-auto">
          <li v-for="(row, idx) in rows" :key="idx" m="y-2" class="border border-gray-300 rounded p-2">
            <div class="flex items-center justify-between gap-2 mb-2">
              <div class="text-xs opacity-70 break-all">
                Key: {{ row.keyText }}
              </div>
              <div class="flex items-center gap-2">
                <button class="btn" :disabled="mutatingRows" @click="setEditorByRow(row)">
                  Edit
                </button>
                <button class="btn" :disabled="mutatingRows" @click="deletePreviewRow(row)">
                  Delete
                </button>
              </div>
            </div>
            <pre class="whitespace-pre-wrap break-all text-xs">{{ formatRow(row.value) }}</pre>
          </li>
        </ul>
      </section>
    </div>
  </main>
</template>
