// import { createLogger, wrapAsyncApiWithLogger } from '~/utils/logger.util'

export const SCREENSHOTS_STORE_NAME = 'screenshots'

export type ScreenshotId = string

export type ScreenshotKind = 'representative' | 'always' | 'never'

export interface ScreenshotRecord {
  id: ScreenshotId
  ts: number
  pageId: string
  clusterId: string
  mime: string
  blob: Blob
  width?: number
  height?: number
  kind: ScreenshotKind
  deletedAt?: number
}

export type CreateScreenshotInput = Omit<ScreenshotRecord, 'id' | 'ts'> & {
  id?: ScreenshotId
  ts?: number
}

export type UpdateScreenshotInput = Partial<Omit<ScreenshotRecord, 'id'>>

export interface ScreenshotsSchemaOptions {
  dbName?: string
  version?: number
}

const screenshotsStoreDefinition: IdbStoreDefinition = {
  name: SCREENSHOTS_STORE_NAME,
  options: { keyPath: 'id' },
  indexes: [
    { name: 'pageId', keyPath: 'pageId' },
    { name: 'clusterId', keyPath: 'clusterId' },
    { name: 'ts', keyPath: 'ts' },
  ],
}

function createScreenshotId(): ScreenshotId {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    return crypto.randomUUID()

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function isActiveScreenshot(record: ScreenshotRecord) {
  return typeof record.deletedAt !== 'number'
}

function filterActiveScreenshots(records: ScreenshotRecord[]) {
  return records.filter(isActiveScreenshot)
}

export function screenshotsSchema(options: ScreenshotsSchemaOptions = {}) {
  const schemaLogger = createLogger('schema:screenshots')

  const idb = useIdb({
    dbName: options.dbName ?? 'flow-dock',
    version: options.version ?? 1,
    stores: [screenshotsStoreDefinition],
  })

  async function createScreenshot(input: CreateScreenshotInput): Promise<ScreenshotRecord> {
    const record: ScreenshotRecord = {
      ...input,
      id: input.id ?? createScreenshotId(),
      ts: input.ts ?? Date.now(),
    }

    await idb.add(SCREENSHOTS_STORE_NAME, record)
    return record
  }

  async function getScreenshot(id: ScreenshotId, includeDeleted = false): Promise<ScreenshotRecord | undefined> {
    const record = await idb.get<ScreenshotRecord>(SCREENSHOTS_STORE_NAME, id)
    if (!includeDeleted && record && !isActiveScreenshot(record))
      return undefined

    return record
  }

  async function listScreenshots(): Promise<ScreenshotRecord[]> {
    const records = await idb.getAll<ScreenshotRecord>(SCREENSHOTS_STORE_NAME)
    return filterActiveScreenshots(records).sort((a, b) => b.ts - a.ts)
  }

  async function updateScreenshot(id: ScreenshotId, patch: UpdateScreenshotInput): Promise<ScreenshotRecord | undefined> {
    const current = await getScreenshot(id)
    if (!current)
      return undefined

    const updated: ScreenshotRecord = {
      ...current,
      ...patch,
      id: current.id,
      ts: patch.ts ?? Date.now(),
    }

    await idb.put(SCREENSHOTS_STORE_NAME, updated)
    return updated
  }

  async function upsertScreenshot(record: ScreenshotRecord): Promise<ScreenshotRecord> {
    const normalized: ScreenshotRecord = {
      ...record,
      id: record.id ?? createScreenshotId(),
      ts: record.ts ?? Date.now(),
    }

    await idb.put(SCREENSHOTS_STORE_NAME, normalized)
    return normalized
  }

  async function softDeleteScreenshot(id: ScreenshotId): Promise<ScreenshotRecord | undefined> {
    return updateScreenshot(id, { deletedAt: Date.now(), ts: Date.now() })
  }

  async function restoreScreenshot(id: ScreenshotId): Promise<ScreenshotRecord | undefined> {
    return updateScreenshot(id, { deletedAt: undefined, ts: Date.now() })
  }

  async function removeScreenshot(id: ScreenshotId): Promise<void> {
    await idb.remove(SCREENSHOTS_STORE_NAME, id)
  }

  async function clearScreenshots(): Promise<void> {
    await idb.clear(SCREENSHOTS_STORE_NAME)
  }

  async function countScreenshots(): Promise<number> {
    return idb.count(SCREENSHOTS_STORE_NAME)
  }

  async function listByPageId(pageId: string): Promise<ScreenshotRecord[]> {
    return idb.withStore(SCREENSHOTS_STORE_NAME, 'readonly', (store) => {
      return new Promise<ScreenshotRecord[]>((resolve, reject) => {
        const request = store.index('pageId').getAll(pageId)
        request.onsuccess = () => {
          const records = filterActiveScreenshots(request.result as ScreenshotRecord[])
          resolve(records.sort((a, b) => b.ts - a.ts))
        }
        request.onerror = () => reject(request.error ?? new Error('Query pageId failed'))
      })
    })
  }

  async function listByClusterId(clusterId: string): Promise<ScreenshotRecord[]> {
    return idb.withStore(SCREENSHOTS_STORE_NAME, 'readonly', (store) => {
      return new Promise<ScreenshotRecord[]>((resolve, reject) => {
        const request = store.index('clusterId').getAll(clusterId)
        request.onsuccess = () => {
          const records = filterActiveScreenshots(request.result as ScreenshotRecord[])
          resolve(records.sort((a, b) => b.ts - a.ts))
        }
        request.onerror = () => reject(request.error ?? new Error('Query clusterId failed'))
      })
    })
  }

  async function listByTsRange(startTs: number, endTs?: number): Promise<ScreenshotRecord[]> {
    const range = typeof endTs === 'number'
      ? IDBKeyRange.bound(startTs, endTs)
      : IDBKeyRange.lowerBound(startTs)

    return idb.withStore(SCREENSHOTS_STORE_NAME, 'readonly', (store) => {
      return new Promise<ScreenshotRecord[]>((resolve, reject) => {
        const request = store.index('ts').getAll(range)
        request.onsuccess = () => {
          const records = filterActiveScreenshots(request.result as ScreenshotRecord[])
          resolve(records.sort((a, b) => b.ts - a.ts))
        }
        request.onerror = () => reject(request.error ?? new Error('Query ts failed'))
      })
    })
  }

  return wrapAsyncApiWithLogger(schemaLogger, {
    createScreenshot,
    getScreenshot,
    listScreenshots,
    updateScreenshot,
    upsertScreenshot,
    softDeleteScreenshot,
    restoreScreenshot,
    removeScreenshot,
    clearScreenshots,
    countScreenshots,
    listByPageId,
    listByClusterId,
    listByTsRange,
  })
}

export const screenshots = screenshotsStoreDefinition
export const screenshotSchema = screenshotsSchema
