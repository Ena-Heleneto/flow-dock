import type { PreviewRow } from '~/types/database-views.type'
import { createEditorTemplate, keyToString, normalizePreviewRows, parseEditorJsonObject } from '~/utils/database-viewer.util'

export function useDbViewer(dbName: MaybeRefOrGetter<string> = 'flow-dock-dev') {
  /**
   * 打开 IndexedDB 数据库
   * @returns 返回一个 Promise，resolved 值为打开的 IDBDatabase 实例
   * @throws 当数据库打开失败时，会 reject 一个 Error 对象，包含错误信息
   */
  function openDatabase(): Promise<IDBDatabase> {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const currentDbName = toValue(dbName)
      const request = indexedDB.open(currentDbName)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error(`Failed to open DB: ${currentDbName}`))
    })
  }

  /**
   * 行ID输入框的值
   * @type {Ref<string>}
   */
  const rowIdInput = ref<string>('')

  /**
   * 行编辑器的文本内容
   * 用于存储当前编辑的行数据文本
   */
  const rowEditorText = ref<string>('')

  /**
   * 是否正在初始化存储状态的响应式引用
   * @type {Ref<boolean>}
   */
  const initializingStores = ref<boolean>(false)

  /**
   * 数据库查看器的加载状态
   * @type {Ref<boolean>}
   * @description 用于跟踪数据库查看器是否正在加载数据，true 表示正在加载，false 表示加载完成
   */
  const loadingStores = ref<boolean>(false)

  /**
   * 数据行加载状态
   * @type {Ref<boolean>}
   * @remarks 用于追踪数据库查看器中数据行的加载进度
   */
  const loadingRows = ref<boolean>(false)

  /**
   * 存储选中的数据库名称
   * @remarks 用于跟踪当前用户选择的数据库
   * @type {Ref<string>}
   */
  const selectedStore = ref<string>('')

  /**
   * 成功消息的响应式引用
   * @type {Ref<string>}
   */
  const successMessage = ref<string>('')

  /**
   * 数据库查看器的错误信息
   * @type {Ref<string>}
   * @remarks 用于存储和显示数据库操作时发生的错误信息
   */
  const errorMessage = ref<string>('')

  /**
   * 存储的数据库名称列表
   * @type {Ref<string[]>}
   */
  const stores = ref<string[]>([])

  /**
   * 数据库查看器中显示的总行数
   * @type {Ref<number>}
   */
  const totalRows = ref<number>(0)

  /**
   * 预览数据的限制数量
   * @type {Ref<number>}
   * @default 50
   */
  const previewLimit = ref<number>(50)

  /**
   * 表示数据库行是否正在进行变更操作的响应式引用
   * @type {Ref<boolean>}
   */
  const mutatingRows = ref<boolean>(false)

  /**
   * 表格行数据列表
   * @type {Ref<PreviewRow[]>}
   * @description 存储数据库预览界面中显示的所有行数据，每个元素为PreviewRow类型
   */
  const rows = ref<PreviewRow[]>([])

  provide<{
    rowIdInput: Ref<string>
    rowEditorText: Ref<string>
    handleResetEditorWithTemplate: () => void
  }>('dbViewerEditor', {
        rowIdInput,
        rowEditorText,
        handleResetEditorWithTemplate,
      })

  /**
   * 发送消息到数据库查看器扩展程序
   * @template T - 响应消息的类型，默认为 unknown
   * @param message - 要发送的消息对象，包含任意键值对
   * @returns 返回扩展程序的响应，类型为 T；如果发送失败或浏览器不支持，返回 null
   * @throws 不会抛出异常，所有错误都会被捕获并返回 null
   */
  async function sendDbViewerMessage<T = unknown>(message: Record<string, unknown>): Promise<T | null> {
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
   * @param store - IndexedDB 对象存储实例
   * @param limit - 要读取的最大行数限制
   * @returns 返回一个 Promise，解析为预览行数组，每行包含键、键文本和值
   * @throws 当游标读取失败时抛出错误
   */
  function readPreviewRows(store: IDBObjectStore, limit: number): Promise<PreviewRow[]> {
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
   * 根据行数据设置编辑器内容
   * @param row - 预览行数据对象，包含键文本和值
   * @remarks
   * 该函数会将行的键文本设置到行ID输入框中，并尝试将行的值序列化为格式化的JSON字符串。
   * 如果JSON序列化失败，则将值转换为字符串格式。
   */
  function setEditorByRow(row: PreviewRow): void {
    rowIdInput.value = row.keyText
    try {
      rowEditorText.value = JSON.stringify(row.value, null, 2)
    }
    catch (error) {
      logger.warn('Failed to stringify row value', error)
      rowEditorText.value = String(row.value)
    }
  }

  /**
   * 解析编辑器中的JSON文本为对象
   *
   * @returns {Record<string, unknown>} 解析后的对象
   * @throws {Error} 当JSON字符串无效时抛出 'Row JSON is invalid' 错误
   * @throws {Error} 当解析结果不是对象或为数组时抛出 'Row JSON must be an object' 错误
   */
  function parseEditorObject(): Record<string, unknown> {
    return parseEditorJsonObject(rowEditorText.value)
  }

  /**
   * 重置编辑器为模板状态
   *
   * 清空行ID输入框并将编辑器内容重置为默认模板。
   * 调用此函数会：
   * - 清除 rowIdInput 的值
   * - 使用 createEditorTemplate() 生成的模板内容重置 rowEditorText
   */
  function handleResetEditorWithTemplate(): void {
    rowIdInput.value = ''
    rowEditorText.value = createEditorTemplate()
  }

  /**
   * 执行一个数据库写操作
   * @param action - 要执行的操作函数，接收IDBObjectStore对象作为参数
   * @returns Promise<void>
   * @throws Error 如果未选择表时抛出错误
   * @remarks
   * 该函数会自动处理事务的打开和关闭，以及数据库连接的清理。
   * 操作完成后会自动等待事务完成并关闭数据库连接。
   */
  async function runStoreWrite(action: (store: IDBObjectStore) => Promise<void>): Promise<void> {
    if (!selectedStore.value)
      throw new Error('Please select a table first')

    const database = await openDatabase()

    try {
      const transaction = database.transaction(selectedStore.value, 'readwrite')
      const store = transaction.objectStore(selectedStore.value)

      await action(store)
      await IdbTransactionUtil.done(transaction)
    }
    finally {
      database.close()
    }
  }

  /**
   * 创建新行记录
   *
   * 该函数处理数据库中新行的创建流程。它会解析编辑器中的对象数据，
   * 验证必需的ID字段，然后将数据写入IndexedDB存储。
   *
   * 流程：
   * 1. 设置变更状态并清空错误/成功消息
   * 2. 解析编辑器对象并获取行ID
   * 3. 验证ID字段的存在性和有效性
   * 4. 通过事务将数据添加到数据库中
   * 5. 刷新当前存储以反映变化
   *
   * @async
   * @throws {Error} 当缺少有效的ID字段时抛出错误
   * @returns {Promise<void>}
   *
   */
  async function handleCreateRow(): Promise<void> {
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
        await IdbTransactionUtil.requestToPromise(store.add(payload))
      })

      rowIdInput.value = payload.id
      successMessage.value = 'Row created successfully'
      await handleRefreshCurrentStore()
    }
    catch (error) {
      errorMessage.value = error instanceof Error ? error.message : String(error)
    }
    finally {
      mutatingRows.value = false
    }
  }

  /**
   * 更新数据库中的行记录
   *
   * 此函数执行以下操作:
   * 1. 验证行ID输入是否为空
   * 2. 解析编辑器中的对象数据作为更新补丁
   * 3. 从IndexedDB存储中获取现有行记录
   * 4. 将补丁数据与现有记录合并(保留原ID)
   * 5. 将更新后的记录写入存储
   * 6. 刷新当前存储的视图
   *
   * @async
   * @function handleUpdateRow
   * @returns {Promise<void>}
   * @throws {Error} 当行ID为空或行记录不存在时抛出错误
   *
   * @remarks
   * - 操作期间会设置 `mutatingRows` 为 true，完成后重置为 false
   * - 成功更新时会显示成功消息
   * - 发生错误时会清除之前的消息并显示错误信息
   * - 此函数依赖于 `rowIdInput`, `parseEditorObject()`, `runStoreWrite()` 和 `handleRefreshCurrentStore()`
   */
  async function handleUpdateRow(): Promise<void> {
    mutatingRows.value = true
    errorMessage.value = ''
    successMessage.value = ''

    try {
      const targetId = rowIdInput.value.trim()
      if (!targetId)
        throw new Error('Update requires a row id')

      const patch = parseEditorObject()

      await runStoreWrite(async (store) => {
        const existing = await IdbTransactionUtil.requestToPromise(store.get(targetId))
        if (!existing || typeof existing !== 'object')
          throw new Error(`Row not found: ${targetId}`)

        const updated = {
          ...(existing as Record<string, unknown>),
          ...patch,
          id: targetId,
        }

        await IdbTransactionUtil.requestToPromise(store.put(updated))
      })

      successMessage.value = 'Row updated successfully'
      await handleRefreshCurrentStore()
    }
    catch (error) {
      errorMessage.value = error instanceof Error ? error.message : String(error)
    }
    finally {
      mutatingRows.value = false
    }
  }

  /**
   * 删除指定行的数据库记录
   *
   * @async
   * @function handleDeleteRow
   * @returns {Promise<void>}
   * @throws 当行ID为空或删除操作失败时会捕获错误
   *
   * @description
   * 根据用户输入的行ID删除数据库中对应的记录。该函数会：
   * 1. 验证行ID是否为空
   * 2. 通过IDB事务执行删除操作
   * 3. 刷新当前存储数据以保持UI最新
   * 4. 设置相应的成功或错误消息提示用户
   *
   * @remarks
   * - 操作期间会设置 `mutatingRows` 为 true，防止重复操作
   * - 错误消息会显示在 `errorMessage.value` 中
   * - 成功消息会显示在 `successMessage.value` 中
   * - 删除前会清空之前的消息状态
   */
  async function handleDeleteRow(): Promise<void> {
    mutatingRows.value = true
    errorMessage.value = ''
    successMessage.value = ''

    try {
      const targetId = rowIdInput.value.trim()
      if (!targetId)
        throw new Error('Delete requires a row id')

      await runStoreWrite(async (store) => {
        await IdbTransactionUtil.requestToPromise(store.delete(targetId))
      })

      successMessage.value = 'Row deleted successfully'
      await handleRefreshCurrentStore()
    }
    catch (error) {
      errorMessage.value = error instanceof Error ? error.message : String(error)
    }
    finally {
      mutatingRows.value = false
    }
  }

  /**
   * 处理删除预览行
   * @param row - 要删除的预览行对象
   * @returns Promise<void>
   */
  async function handleDeletePreviewRow(row: PreviewRow): Promise<void> {
    rowIdInput.value = row.keyText
    await handleDeleteRow()
  }

  /**
   * 初始化所有数据库存储
   *
   * 该函数负责初始化后台的所有数据库存储。首先尝试通过消息发送初始化数据库查看器，
   * 如果初始化失败则抛出错误。如果没有远程响应，则打开数据库连接并立即关闭。
   * 最后刷新所有存储和当前存储的数据。
   *
   * @returns {Promise<void>} 返回一个异步操作的承诺
   * @throws {Error} 当初始化存储失败时抛出错误，错误信息会被赋值给 errorMessage.value
   *
   * 此函数会：
   * 1. 设置 initializingStores 为 true 表示正在初始化
   * 2. 清空之前的错误信息
   * 3. 发送初始化消息到后台工作进程
   * 4. 验证初始化结果，失败则抛出错误
   * 5. 如果无远程响应，则本地打开并关闭数据库连接
   * 6. 刷新所有存储和当前存储数据
   * 7. 捕获任何错误并更新错误消息
   * 8. 最终设置 initializingStores 为 false
   */
  async function handleInitializeAllStores(): Promise<void> {
    initializingStores.value = true
    errorMessage.value = ''

    try {
      const remote = await sendDbViewerMessage<{ ok?: boolean, error?: string }>({
        type: 'db-viewer/initialize',
        dbName: toValue(dbName),
      })

      if (remote?.ok === false)
        throw new Error(remote.error || 'Failed to initialize stores in background')

      if (!remote) {
        const database = await openDatabase()
        database.close()
      }

      await handleRefreshStores()
      await handleRefreshCurrentStore()
    }
    catch (error) {
      errorMessage.value = error instanceof Error ? error.message : String(error)
    }
    finally {
      initializingStores.value = false
    }
  }

  /**
   * 刷新数据库存储空间列表
   *
   * 该函数异步加载数据库中的所有对象存储空间名称。首先尝试从后台服务获取存储空间列表，
   * 如果失败则降级为本地数据库查询。如果存储空间列表为空，则清空已选中的存储空间和行数据。
   * 如果当前选中的存储空间不在新列表中，则自动选中第一个存储空间。
   *
   * @async
   * @function handleRefreshStores
   * @returns {Promise<void>}
   * @throws {Error} 当后台服务返回错误或数据库操作失败时抛出异常，错误信息会被存储在 errorMessage 中
   *
   * @remarks
   * - 在执行期间会设置 loadingStores.value 为 true，完成后设置为 false
   * - 任何错误都会被捕获并存储在 errorMessage.value 中
   * - 该函数会自动更新 stores、selectedStore、totalRows 和 rows 等响应式变量
   */
  async function handleRefreshStores(): Promise<void> {
    loadingStores.value = true
    errorMessage.value = ''

    try {
      const remote = await sendDbViewerMessage<{ ok?: boolean, stores?: string[], error?: string }>({
        type: 'db-viewer/stores',
        dbName: toValue(dbName),
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

  /**
   * 刷新当前数据库存储的行数据
   *
   * 该函数会先尝试从后台进程获取数据库存储的行数据。如果后台请求成功，则使用返回的数据；
   * 否则会降级到本地 IndexedDB 直接查询。
   *
   * 流程：
   * 1. 如果未选择存储对象，则清空行数据并返回
   * 2. 设置加载状态，清除错误信息
   * 3. 尝试从后台请求行数据（受预览限制）
   * 4. 如果后台请求失败，降级到本地 IndexedDB 查询
   * 5. 更新总行数和预览行数据
   * 6. 捕获错误并更新错误信息
   * 7. 最后清除加载状态
   *
   * @async
   * @returns {Promise<void>}
   * @throws 不直接抛出，错误被捕获并存储在 errorMessage.value 中
   */
  async function handleRefreshCurrentStore(): Promise<void> {
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
        dbName: toValue(dbName),
        storeName: selectedStore.value,
        limit: previewLimit.value,
      })

      if (remote?.ok === false)
        throw new Error(remote.error || 'Failed to load rows from background')

      const [count, preview] = remote?.ok
        ? [remote.total ?? 0, normalizePreviewRows(remote.rows ?? [])]
        : await (async () => {
          const database = await openDatabase()
          const transaction = database.transaction(selectedStore.value, 'readonly')
          const store = transaction.objectStore(selectedStore.value)

          const localResult = await Promise.all([
            IdbTransactionUtil.requestToPromise<number>(store.count()),
            readPreviewRows(store, previewLimit.value),
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

  /**
   * 绑定查看器生命周期
   *
   * 设置数据库查看器的生命周期钩子，包括：
   * - 当选中的存储改变时，重置错误和成功消息，重置编辑器模板，并刷新当前存储
   * - 组件挂载时，初始化所有存储、刷新存储列表、刷新当前存储，并重置编辑器模板
   */
  function bindViewerLifecycle(): void {
    watch(selectedStore, async () => {
      errorMessage.value = ''
      successMessage.value = ''
      handleResetEditorWithTemplate()
      await handleRefreshCurrentStore()
    })

    onMounted(async () => {
      await handleInitializeAllStores()
      await handleRefreshStores()
      await handleRefreshCurrentStore()
      handleResetEditorWithTemplate()
    })
  }

  return {
    initializingStores,
    loadingStores,
    loadingRows,
    selectedStore,
    successMessage,
    errorMessage,
    stores,
    totalRows,
    previewLimit,
    mutatingRows,
    rows,
    setEditorByRow,
    handleCreateRow,
    handleUpdateRow,
    handleDeleteRow,
    handleDeletePreviewRow,
    handleInitializeAllStores,
    handleRefreshStores,
    handleRefreshCurrentStore,
    bindViewerLifecycle,
    runStoreWrite,
    rowIdInput,
    rowEditorText,
    handleResetEditorWithTemplate,
  }
}
