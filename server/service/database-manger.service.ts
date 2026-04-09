import browser from 'webextension-polyfill'

export const DATABASE_MANGER_STORAGE_KEY = 'database-manger:records'

export interface DatabaseMangerRecord {
  value: unknown
  updatedAt: number
  updatedBy: {
    module: string
    page: string
    traceId: string
  }
}

export type DatabaseMangerCollection = Record<string, DatabaseMangerRecord>

export async function readDatabaseMangerCollection(): Promise<DatabaseMangerCollection> {
  const stored = await browser.storage.local.get(DATABASE_MANGER_STORAGE_KEY)
  return normalizeCollection(stored[DATABASE_MANGER_STORAGE_KEY])
}

export async function writeDatabaseMangerCollection(collection: DatabaseMangerCollection) {
  await browser.storage.local.set({
    [DATABASE_MANGER_STORAGE_KEY]: collection,
  })
}

function normalizeCollection(input: unknown): DatabaseMangerCollection {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return {}

  return {
    ...(input as DatabaseMangerCollection),
  }
}
