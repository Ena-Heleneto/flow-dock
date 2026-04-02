import { onMessage, sendMessage } from 'webext-bridge/background'
import type { Tabs } from 'webextension-polyfill'
import { PageSchema } from './schemas/pages.schema'
import { registerControllers, registerRouterEventHandlers } from './register'

function openDatabase(dbName: string) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(dbName)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error(`Failed to open DB: ${dbName}`))
  })
}

function toPreviewValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value instanceof Blob)
    return { __type: 'Blob', size: value.size, mime: value.type }

  if (Array.isArray(value))
    return value.map(item => toPreviewValue(item, seen))

  if (value && typeof value === 'object') {
    if (seen.has(value))
      return '[Circular]'

    seen.add(value)
    const next: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value))
      next[key] = toPreviewValue(item, seen)
    return next
  }

  return value
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

      records.push(toPreviewValue(cursor.value))
      cursor.continue()
    }

    request.onerror = () => reject(request.error ?? new Error('Failed to read preview rows'))
  })
}

async function listStores(dbName: string) {
  const database = await openDatabase(dbName)
  try {
    return Array.from(database.objectStoreNames)
  }
  finally {
    database.close()
  }
}

async function readStorePreview(dbName: string, storeName: string, limit: number) {
  const database = await openDatabase(dbName)
  try {
    if (!database.objectStoreNames.contains(storeName))
      return { total: 0, rows: [] as unknown[] }

    const transaction = database.transaction(storeName, 'readonly')
    const store = transaction.objectStore(storeName)
    const [total, rows] = await Promise.all([
      new Promise<number>((resolve, reject) => {
        const request = store.count()
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error ?? new Error('Failed to count rows'))
      }),
      readPreviewRows(store, limit),
    ])

    return { total, rows }
  }
  finally {
    database.close()
  }
}

async function countStoreRows(dbName: string, storeName: string) {
  const database = await openDatabase(dbName)
  try {
    if (!database.objectStoreNames.contains(storeName))
      return 0

    const transaction = database.transaction(storeName, 'readonly')
    const store = transaction.objectStore(storeName)
    return await new Promise<number>((resolve, reject) => {
      const request = store.count()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Failed to count rows'))
    })
  }
  finally {
    database.close()
  }
}

// only on dev mode
if (import.meta.hot) {
  // @ts-expect-error for background HMR
  import('/@vite/client')
  // load latest content script
  import('./contentScriptHMR').then(({ registerContentScriptHMR }) => {
    registerContentScriptHMR(import.meta.env.VITE_DEV_CONTENT_SCRIPT_FILE || 'dist/contentScripts/index.global.js')
  })
}

// remove or turn this off if you don't use side panel
const USE_SIDE_PANEL = true

// to toggle the sidepanel with the action button in chromium:
if (USE_SIDE_PANEL) {
  // @ts-expect-error missing types
  browser.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error: unknown) => console.error(error))
}

browser.runtime.onInstalled.addListener((): void => {
  // eslint-disable-next-line no-console
  console.log('Extension installed')
})

let previousTabId = 0
registerControllers()
registerRouterEventHandlers()

// communication example: send previous tab title from background page
// see shim.d.ts for type declaration
browser.tabs.onActivated.addListener(async ({ tabId }) => {
  if (!previousTabId) {
    previousTabId = tabId
    return
  }

  let tab: Tabs.Tab

  try {
    tab = await browser.tabs.get(previousTabId)
    previousTabId = tabId
  }
  catch {
    return
  }

  // eslint-disable-next-line no-console
  console.log('previous tab', tab)
  sendMessage('tab-prev', { title: tab.title }, { context: 'content-script', tabId })
})

onMessage('get-current-tab', async () => {
  try {
    const tab = await browser.tabs.get(previousTabId)
    return {
      title: tab?.title,
    }
  }
  catch {
    return {
      title: undefined,
    }
  }
})

browser.runtime.onMessage.addListener((message: unknown) => {
  const payload = message as {
    type?: string
    dbName?: string
    storeName?: string
    limit?: number
  }

  if (!payload?.type)
    return

  if (!payload.type.startsWith('db-viewer/'))
    return

  const dbName = payload.dbName || 'flow-dock-dev'

  if (payload.type === 'db-viewer/initialize') {
    return (async () => {
      await Promise.all([
        countStoreRows(dbName, PageSchema.name),
        countStoreRows(dbName, ScreenshotSchema.name),
        countStoreRows(dbName, ScreenshotLinksSchema.name),
        countStoreRows(dbName, KvConfigsSchema.name),
        clustersSchema({ dbName }).countClusters(),
        componentsSchema({ dbName }).countComponents(),
        bundleSchema({ dbName }).countBundles(),
        bundleComponentsSchema({ dbName }).countBundleComponents(),
        pageBundlesSchema({ dbName }).countPageBundles(),
        pageComponentsSchema({ dbName }).countPageComponents(),
        // kvConfigsSchema({ dbName }).countConfigs(),

        clusterLinksSchema({ dbName }).countClusterLinks(),
      ])

      return { ok: true }
    })().catch((error: unknown) => ({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }))
  }

  if (payload.type === 'db-viewer/stores') {
    return listStores(dbName)
      .then(stores => ({ ok: true, stores }))
      .catch((error: unknown) => ({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }))
  }

  if (payload.type === 'db-viewer/rows') {
    const storeName = payload.storeName
    if (!storeName)
      return Promise.resolve({ ok: false, error: 'storeName is required' })

    const limit = Math.max(1, Math.floor(payload.limit ?? 50))
    return readStorePreview(dbName, storeName, limit)
      .then(data => ({ ok: true, ...data }))
      .catch((error: unknown) => ({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }))
  }
})
