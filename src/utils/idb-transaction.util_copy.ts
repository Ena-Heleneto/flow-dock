export class IdbTransactionUtilCopy {
  static requestToPromise<T = unknown>(request: IDBRequest<T>) {
    return new Promise<T>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
    })
  }

  static normalizeStoreNames(storeNames: string | string[]) {
    const names = Array.isArray(storeNames) ? storeNames : [storeNames]
    const uniqueNames = [...new Set(names.filter(Boolean))]

    if (!uniqueNames.length)
      throw new Error('Transaction requires at least one object store')

    return uniqueNames
  }

  static done(transaction: IDBTransaction) {
    return new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
      transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
    })
  }

  static async run<T>({ database, storeNames, mode, action }: RunTransactionOptions<T>) {
    const names = IdbTransactionUtil.normalizeStoreNames(storeNames)
    const nameSet = new Set(names)
    const transaction = database.transaction(names, mode)
    const donePromise = IdbTransactionUtil.done(transaction)

    const context: IdbTransactionContext = {
      transaction,
      getStore(storeName: string) {
        if (!nameSet.has(storeName))
          throw new Error(`Store "${storeName}" is not part of current transaction`)
        return transaction.objectStore(storeName)
      },
    }

    try {
      const result = await action(context)
      await donePromise
      return result
    }
    catch (error) {
      try {
        transaction.abort()
      }
      catch {
      }

      await donePromise.catch(() => undefined)
      throw error
    }
  }
}
