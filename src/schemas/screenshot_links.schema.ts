export const SCREENSHOT_LINKS_STORE_NAME = 'screenshot_links'

export type ScreenshotLinkId = string

export interface ScreenshotLinkRecord {
  id: ScreenshotLinkId
  screenshotId: string
  pageId?: string
  componentId?: string
  bundleId?: string
  ts: number
  deletedAt?: number
}

export type CreateScreenshotLinkInput = Omit<ScreenshotLinkRecord, 'id' | 'ts'> & {
  id?: ScreenshotLinkId
  ts?: number
}

export type UpdateScreenshotLinkInput = Partial<Omit<ScreenshotLinkRecord, 'id' | 'screenshotId'>>

export interface ScreenshotLinksSchemaOptions {
  dbName?: string
  version?: number
}

const screenshotLinksStoreDefinition: IdbStoreDefinition = {
  name: SCREENSHOT_LINKS_STORE_NAME,
  options: { keyPath: 'id' },
  indexes: [
    { name: 'screenshotId', keyPath: 'screenshotId', options: { unique: true } },
    { name: 'pageId', keyPath: 'pageId', options: { unique: true } },
    { name: 'componentId', keyPath: 'componentId', options: { unique: true } },
    { name: 'bundleId', keyPath: 'bundleId', options: { unique: true } },
    { name: 'ts', keyPath: 'ts' },
  ],
}

function hasAnyTarget(input: { pageId?: string, componentId?: string, bundleId?: string }) {
  return Boolean(input.pageId || input.componentId || input.bundleId)
}

function isActiveLink(record: ScreenshotLinkRecord) {
  return typeof record.deletedAt !== 'number'
}

function filterActiveLinks(records: ScreenshotLinkRecord[]) {
  return records.filter(isActiveLink)
}

function createLinkId(screenshotId: string): ScreenshotLinkId {
  return screenshotId
}

export function screenshotLinksSchema(options: ScreenshotLinksSchemaOptions = {}) {
  const idb = useIdb({
    dbName: options.dbName ?? 'flow-dock',
    version: options.version ?? 1,
    stores: [screenshotLinksStoreDefinition],
  })

  async function createScreenshotLink(input: CreateScreenshotLinkInput): Promise<ScreenshotLinkRecord> {
    if (!hasAnyTarget(input))
      throw new Error('At least one target is required: pageId/componentId/bundleId')

    const record: ScreenshotLinkRecord = {
      ...input,
      id: input.id ?? createLinkId(input.screenshotId),
      ts: input.ts ?? Date.now(),
    }

    await idb.add(SCREENSHOT_LINKS_STORE_NAME, record)
    return record
  }

  async function getScreenshotLink(id: ScreenshotLinkId, includeDeleted = false): Promise<ScreenshotLinkRecord | undefined> {
    const record = await idb.get<ScreenshotLinkRecord>(SCREENSHOT_LINKS_STORE_NAME, id)
    if (!includeDeleted && record && !isActiveLink(record))
      return undefined

    return record
  }

  async function getByScreenshotId(screenshotId: string, includeDeleted = false): Promise<ScreenshotLinkRecord | undefined> {
    return idb.withStore(SCREENSHOT_LINKS_STORE_NAME, 'readonly', (store) => {
      return new Promise<ScreenshotLinkRecord | undefined>((resolve, reject) => {
        const request = store.index('screenshotId').get(screenshotId)
        request.onsuccess = () => {
          const record = request.result as ScreenshotLinkRecord | undefined
          if (!includeDeleted && record && !isActiveLink(record)) {
            resolve(undefined)
            return
          }
          resolve(record)
        }
        request.onerror = () => reject(request.error ?? new Error('Query screenshotId failed'))
      })
    })
  }

  async function listScreenshotLinks(): Promise<ScreenshotLinkRecord[]> {
    const records = await idb.getAll<ScreenshotLinkRecord>(SCREENSHOT_LINKS_STORE_NAME)
    return filterActiveLinks(records).sort((a, b) => b.ts - a.ts)
  }

  async function updateScreenshotLink(id: ScreenshotLinkId, patch: UpdateScreenshotLinkInput): Promise<ScreenshotLinkRecord | undefined> {
    const current = await getScreenshotLink(id)
    if (!current)
      return undefined

    const updated: ScreenshotLinkRecord = {
      ...current,
      ...patch,
      id: current.id,
      screenshotId: current.screenshotId,
      ts: patch.ts ?? Date.now(),
    }

    if (!hasAnyTarget(updated))
      throw new Error('At least one target is required: pageId/componentId/bundleId')

    await idb.put(SCREENSHOT_LINKS_STORE_NAME, updated)
    return updated
  }

  async function upsertScreenshotLink(record: ScreenshotLinkRecord): Promise<ScreenshotLinkRecord> {
    if (!hasAnyTarget(record))
      throw new Error('At least one target is required: pageId/componentId/bundleId')

    const normalized: ScreenshotLinkRecord = {
      ...record,
      id: record.id ?? createLinkId(record.screenshotId),
      ts: record.ts ?? Date.now(),
    }

    await idb.put(SCREENSHOT_LINKS_STORE_NAME, normalized)
    return normalized
  }

  async function softDeleteScreenshotLink(id: ScreenshotLinkId): Promise<ScreenshotLinkRecord | undefined> {
    return updateScreenshotLink(id, { deletedAt: Date.now(), ts: Date.now() })
  }

  async function restoreScreenshotLink(id: ScreenshotLinkId): Promise<ScreenshotLinkRecord | undefined> {
    return updateScreenshotLink(id, { deletedAt: undefined, ts: Date.now() })
  }

  async function removeScreenshotLink(id: ScreenshotLinkId): Promise<void> {
    await idb.remove(SCREENSHOT_LINKS_STORE_NAME, id)
  }

  async function clearScreenshotLinks(): Promise<void> {
    await idb.clear(SCREENSHOT_LINKS_STORE_NAME)
  }

  async function countScreenshotLinks(): Promise<number> {
    return idb.count(SCREENSHOT_LINKS_STORE_NAME)
  }

  async function getByPageId(pageId: string, includeDeleted = false): Promise<ScreenshotLinkRecord | undefined> {
    return idb.withStore(SCREENSHOT_LINKS_STORE_NAME, 'readonly', (store) => {
      return new Promise<ScreenshotLinkRecord | undefined>((resolve, reject) => {
        const request = store.index('pageId').get(pageId)
        request.onsuccess = () => {
          const record = request.result as ScreenshotLinkRecord | undefined
          if (!includeDeleted && record && !isActiveLink(record)) {
            resolve(undefined)
            return
          }
          resolve(record)
        }
        request.onerror = () => reject(request.error ?? new Error('Query pageId failed'))
      })
    })
  }

  async function getByComponentId(componentId: string, includeDeleted = false): Promise<ScreenshotLinkRecord | undefined> {
    return idb.withStore(SCREENSHOT_LINKS_STORE_NAME, 'readonly', (store) => {
      return new Promise<ScreenshotLinkRecord | undefined>((resolve, reject) => {
        const request = store.index('componentId').get(componentId)
        request.onsuccess = () => {
          const record = request.result as ScreenshotLinkRecord | undefined
          if (!includeDeleted && record && !isActiveLink(record)) {
            resolve(undefined)
            return
          }
          resolve(record)
        }
        request.onerror = () => reject(request.error ?? new Error('Query componentId failed'))
      })
    })
  }

  async function getByBundleId(bundleId: string, includeDeleted = false): Promise<ScreenshotLinkRecord | undefined> {
    return idb.withStore(SCREENSHOT_LINKS_STORE_NAME, 'readonly', (store) => {
      return new Promise<ScreenshotLinkRecord | undefined>((resolve, reject) => {
        const request = store.index('bundleId').get(bundleId)
        request.onsuccess = () => {
          const record = request.result as ScreenshotLinkRecord | undefined
          if (!includeDeleted && record && !isActiveLink(record)) {
            resolve(undefined)
            return
          }
          resolve(record)
        }
        request.onerror = () => reject(request.error ?? new Error('Query bundleId failed'))
      })
    })
  }

  async function listByTsRange(startTs: number, endTs?: number): Promise<ScreenshotLinkRecord[]> {
    const range = typeof endTs === 'number'
      ? IDBKeyRange.bound(startTs, endTs)
      : IDBKeyRange.lowerBound(startTs)

    return idb.withStore(SCREENSHOT_LINKS_STORE_NAME, 'readonly', (store) => {
      return new Promise<ScreenshotLinkRecord[]>((resolve, reject) => {
        const request = store.index('ts').getAll(range)
        request.onsuccess = () => {
          const records = filterActiveLinks(request.result as ScreenshotLinkRecord[])
          resolve(records.sort((a, b) => b.ts - a.ts))
        }
        request.onerror = () => reject(request.error ?? new Error('Query ts failed'))
      })
    })
  }

  return {
    createScreenshotLink,
    getScreenshotLink,
    getByScreenshotId,
    listScreenshotLinks,
    updateScreenshotLink,
    upsertScreenshotLink,
    softDeleteScreenshotLink,
    restoreScreenshotLink,
    removeScreenshotLink,
    clearScreenshotLinks,
    countScreenshotLinks,
    getByPageId,
    getByComponentId,
    getByBundleId,
    listByTsRange,
  }
}

export const screenshot_links = screenshotLinksStoreDefinition
export const screenshot_linksSchema = screenshotLinksSchema
