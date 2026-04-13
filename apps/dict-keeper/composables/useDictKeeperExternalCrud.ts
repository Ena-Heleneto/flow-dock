import { request } from '~/shared/composables/useRouterRequest'

type NoticeTone = 'neutral' | 'success' | 'error'

export const REQUEST_METHOD_OPTIONS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const
export const ENDPOINT_MERGE_STRATEGY_OPTIONS = ['auth-overrides', 'payload-overrides'] as const

export type DictKeeperRequestMethod = (typeof REQUEST_METHOD_OPTIONS)[number]
export type DictKeeperRequestMethodInput = DictKeeperRequestMethod | ''
export type DictKeeperEndpointMergeStrategy = (typeof ENDPOINT_MERGE_STRATEGY_OPTIONS)[number]
export type DictKeeperCrudAction = 'create' | 'read' | 'update' | 'delete'
export type DictKeeperCrudSection = 'dictionary' | 'item'
export type DictKeeperAuthInjectTarget = 'header' | 'params' | 'data'

const REQUEST_METHOD_SET = new Set<DictKeeperRequestMethod>(REQUEST_METHOD_OPTIONS)

export interface DictKeeperCrudEndpointNode {
  path: string
  method: DictKeeperRequestMethodInput
  pathTemplate?: string
  queryTemplate?: Record<string, string>
  headerTemplate?: Record<string, string>
  bodyTemplate?: unknown
  contentType?: string
  timeoutMs?: number
  mergeStrategy?: DictKeeperEndpointMergeStrategy | ''
}

export interface DictKeeperCrudEndpointConfig {
  create: DictKeeperCrudEndpointNode
  read: DictKeeperCrudEndpointNode
  update: DictKeeperCrudEndpointNode
  delete: DictKeeperCrudEndpointNode
}

export interface DictKeeperExternalCrudForm {
  basePath: string
  dictionary: DictKeeperCrudEndpointConfig
  item: DictKeeperCrudEndpointConfig
}

export interface DictKeeperExternalCrudRecord extends DictKeeperExternalCrudForm {
  _id: string
  name: string
  isDefault?: boolean
  isDeleted?: boolean
  deletedAt?: number
  createdAt?: number
  updatedAt?: number
}

interface DictKeeperExternalCrudItemResponseData {
  item: DictKeeperExternalCrudRecord | null
}

interface DictKeeperExternalCrudListResponseData {
  items: DictKeeperExternalCrudRecord[]
}

interface DictKeeperExternalCrudExecuteResponseData {
  result: DictKeeperExternalCrudExecuteResult
}

export interface DictKeeperExternalCrudBusinessRule {
  fieldPath: string
  expectedValue: unknown
}

export interface DictKeeperExternalCrudExecuteInput {
  id?: string
  section: DictKeeperCrudSection
  action: DictKeeperCrudAction
  payload?: unknown
  authData?: Record<string, unknown>
  injectTarget?: DictKeeperAuthInjectTarget
  successRule?: DictKeeperExternalCrudBusinessRule
  timeoutMs?: number
}

export interface DictKeeperExternalCrudExecuteResult {
  id: string
  section: DictKeeperCrudSection
  action: DictKeeperCrudAction
  url: string
  method: DictKeeperRequestMethod
  status: number
  statusText: string
  durationMs: number
  injectTarget: DictKeeperAuthInjectTarget
  business: {
    enabled: boolean
    fieldPath?: string
    expectedValue?: unknown
    actualValue?: unknown
  }
  response: {
    data: unknown
    rawText: string
  }
}

export interface DictKeeperExternalCrudSnapshot {
  id: string
  name: string
  basePath: string
  dictionary: DictKeeperCrudEndpointConfig
  item: DictKeeperCrudEndpointConfig
  isDefault: boolean
  createdAt?: number
  updatedAt?: number
}

const DEFAULT_EXTERNAL_CRUD_ID = 'dict-keeper-global-external-crud'
const DEFAULT_EXTERNAL_CRUD_NAME = '默认外部 CRUD'
const REQUEST_TIMEOUT_MS = 12000

interface LoadExternalCrudOptions {
  silent?: boolean
  allowDefaultWhenIdEmpty?: boolean
}

interface InitializeExternalCrudOptions {
  silent?: boolean
}

let sharedDictKeeperExternalCrudStore: ReturnType<typeof createDictKeeperExternalCrudStore> | null = null

export function useDictKeeperExternalCrud() {
  if (sharedDictKeeperExternalCrudStore)
    return sharedDictKeeperExternalCrudStore

  sharedDictKeeperExternalCrudStore = createDictKeeperExternalCrudStore()
  return sharedDictKeeperExternalCrudStore
}

function createDictKeeperExternalCrudStore() {
  const form = reactive<DictKeeperExternalCrudForm>(createDefaultForm())
  const selectedExternalCrudId = ref('')
  const externalCrudNameInput = ref('')
  const externalCrudList = ref<DictKeeperExternalCrudRecord[]>([])
  const loadedExternalCrudId = ref('')
  const loadedExternalCrudName = ref('')
  const currentConfigSnapshot = ref<DictKeeperExternalCrudSnapshot | null>(null)

  const externalCrudId = computed(() => loadedExternalCrudId.value)

  const hasExternalCrud = computed(() => loadedExternalCrudId.value.length > 0)
  const isListLoading = ref(false)
  const isLoading = ref(false)
  const isSaving = ref(false)
  const isDeleting = ref(false)
  const isSettingDefault = ref(false)

  const validationErrors = ref<string[]>([])
  const noticeText = ref('')
  const noticeTone = ref<NoticeTone>('neutral')

  async function refreshExternalCrudList() {
    isListLoading.value = true

    try {
      const data = await requestData<DictKeeperExternalCrudListResponseData, { includeDeleted?: boolean }>('/dict-keeper/external-crud/list', {
        method: 'GET',
        body: {
          includeDeleted: false,
        },
      })

      const normalizedItems = data.items
        .map(normalizeExternalCrudRecord)
        .sort(compareByRecent)

      externalCrudList.value = normalizedItems

      if (normalizedItems.length === 0) {
        selectedExternalCrudId.value = ''
        clearLoadedSnapshot()
        return []
      }

      const selectedExists = normalizedItems.some(item => item._id === selectedExternalCrudId.value)
      if (!selectedExists)
        selectedExternalCrudId.value = ''

      const loadedExists = normalizedItems.some(item => item._id === loadedExternalCrudId.value)
      if (!loadedExists)
        clearLoadedSnapshot()

      syncCurrentConfigSnapshotByList(normalizedItems)

      return normalizedItems
    }
    catch (error) {
      setNotice(`刷新外部 CRUD 列表失败：${toErrorMessage(error)}`, 'error')
      return []
    }
    finally {
      isListLoading.value = false
    }
  }

  async function initializeExternalCrud(options: InitializeExternalCrudOptions = {}) {
    clearValidationErrors()

    if (!options.silent)
      setNotice('', 'neutral')

    selectedExternalCrudId.value = ''
    clearLoadedSnapshot()
    resetForm()
    externalCrudNameInput.value = ''

    const list = await refreshExternalCrudList()
    if (list.length === 0) {
      resetForm()
      externalCrudNameInput.value = DEFAULT_EXTERNAL_CRUD_NAME

      if (!options.silent && noticeTone.value !== 'error')
        setNotice('尚未创建外部 CRUD，请先新建。', 'neutral')

      return null
    }

    const record = await loadExternalCrudById(undefined, {
      silent: true,
      allowDefaultWhenIdEmpty: true,
    })

    if (!record) {
      if (!options.silent)
        setNotice('请先从列表选择一个外部 CRUD 并加载。', 'neutral')

      return null
    }

    if (!options.silent) {
      setNotice(
        record.isDefault === true ? '已自动加载默认外部 CRUD。' : '已自动加载可用外部 CRUD。',
        'success',
      )
    }

    return record
  }

  async function loadExternalCrud() {
    return initializeExternalCrud()
  }

  async function loadExternalCrudById(id: string | undefined, options: LoadExternalCrudOptions = {}) {
    const targetId = normalizeText(id)
    const shouldLoadDefault = !targetId && options.allowDefaultWhenIdEmpty === true

    if (!targetId && !shouldLoadDefault) {
      clearLoadedSnapshot()

      if (!options.silent)
        setNotice('请先从外部 CRUD 列表中选择一项。', 'neutral')

      return null
    }

    isLoading.value = true
    clearValidationErrors()

    if (!options.silent)
      setNotice('', 'neutral')

    try {
      const data = await requestData<DictKeeperExternalCrudItemResponseData, { id?: string, includeDeleted?: boolean }>(
        '/dict-keeper/external-crud/read',
        {
          method: 'GET',
          body: shouldLoadDefault
            ? {
                includeDeleted: false,
              }
            : {
                id: targetId,
                includeDeleted: false,
              },
        },
      )

      const record = data.item
      if (!record) {
        selectedExternalCrudId.value = ''
        clearLoadedSnapshot()
        resetForm()
        externalCrudNameInput.value = shouldLoadDefault ? DEFAULT_EXTERNAL_CRUD_NAME : ''

        if (!options.silent) {
          setNotice(
            shouldLoadDefault
              ? '未找到默认外部 CRUD，请先创建或选择配置。'
              : '未找到所选外部 CRUD，请刷新列表后重试。',
            'error',
          )
        }

        return null
      }

      const normalizedRecord = normalizeExternalCrudRecord(record)

      selectedExternalCrudId.value = normalizedRecord._id || DEFAULT_EXTERNAL_CRUD_ID
      setLoadedSnapshot(normalizedRecord)
      applyRecord(normalizedRecord)
      externalCrudNameInput.value = normalizeExternalCrudName(normalizedRecord.name, normalizedRecord._id)

      if (!options.silent) {
        setNotice(
          shouldLoadDefault
            ? normalizedRecord.isDefault === true
              ? '已加载默认外部 CRUD。'
              : '已加载可用外部 CRUD。'
            : '已加载所选外部 CRUD。',
          'success',
        )
      }

      return normalizedRecord
    }
    catch (error) {
      if (!options.silent)
        setNotice(`加载外部 CRUD 失败：${toErrorMessage(error)}`, 'error')

      return null
    }
    finally {
      isLoading.value = false
    }
  }

  async function setDefaultExternalCrud(id: string | undefined, options: LoadExternalCrudOptions = {}) {
    const targetId = normalizeText(id)
    if (!targetId) {
      if (!options.silent)
        setNotice('请先选择一个外部 CRUD 后再设为默认。', 'neutral')

      return null
    }

    isSettingDefault.value = true

    if (!options.silent)
      setNotice('', 'neutral')

    try {
      const data = await requestData<DictKeeperExternalCrudItemResponseData, { id?: string }>('/dict-keeper/external-crud/set-default', {
        method: 'PUT',
        body: {
          id: targetId,
        },
      })

      const record = data.item
      if (!record) {
        if (!options.silent)
          setNotice('未找到要设为默认的外部 CRUD。', 'error')

        return null
      }

      const normalizedRecord = normalizeExternalCrudRecord(record)
      await refreshExternalCrudList()

      if (normalizeText(loadedExternalCrudId.value) === normalizeText(normalizedRecord._id)) {
        setLoadedSnapshot(normalizedRecord)
        applyRecord(normalizedRecord)
        externalCrudNameInput.value = normalizeExternalCrudName(normalizedRecord.name, normalizedRecord._id)
      }

      syncCurrentConfigSnapshot(normalizedRecord)

      if (!options.silent)
        setNotice('已将当前配置设为默认外部 CRUD。', 'success')

      return normalizedRecord
    }
    catch (error) {
      if (!options.silent)
        setNotice(`设为默认外部 CRUD 失败：${toErrorMessage(error)}`, 'error')

      return null
    }
    finally {
      isSettingDefault.value = false
    }
  }

  async function selectExternalCrudAsDefault(id: string | undefined) {
    const record = await loadExternalCrudById(id, { silent: true })
    if (!record) {
      const normalizedId = normalizeText(id)
      setNotice(
        normalizedId ? '未找到所选外部 CRUD，请刷新列表后重试。' : '请先从外部 CRUD 列表中选择一项。',
        normalizedId ? 'error' : 'neutral',
      )

      return null
    }

    const defaultRecord = await setDefaultExternalCrud(record._id, { silent: true })
    if (!defaultRecord) {
      setNotice('已加载所选配置，但设为默认失败，请重试。', 'error')
      return record
    }

    setNotice('已加载并设为默认外部 CRUD。', 'success')
    return defaultRecord
  }

  async function saveExternalCrud() {
    clearValidationErrors()
    if (!validateForm()) {
      setNotice('请先修正表单校验错误后再保存。', 'error')
      return null
    }

    const normalizedInputName = normalizeText(externalCrudNameInput.value)
    const normalizedLoadedId = normalizeText(loadedExternalCrudId.value)
    const normalizedLoadedName = normalizeText(loadedExternalCrudName.value)
    const loadedExistsInList = normalizedLoadedId.length > 0
      && externalCrudList.value.some(item => item._id === normalizedLoadedId)

    const matchedByName = findExternalCrudByName(normalizedInputName)

    const shouldUpdateLoaded = loadedExistsInList
      && normalizedInputName.length > 0
      && normalizedInputName === normalizedLoadedName

    const shouldUpdateByName = !shouldUpdateLoaded && Boolean(matchedByName)
    const shouldUpdate = shouldUpdateLoaded || shouldUpdateByName
    const updateTargetId = shouldUpdateLoaded
      ? normalizedLoadedId
      : normalizeText(matchedByName?._id)

    const nextId = shouldUpdate ? updateTargetId : createExternalCrudId()

    isSaving.value = true
    setNotice('', 'neutral')

    try {
      const payload = {
        id: nextId,
        name: normalizeExternalCrudName(externalCrudNameInput.value, nextId),
        ...buildNormalizedFormPayload(),
      }

      const data = shouldUpdate
        ? await requestData<DictKeeperExternalCrudItemResponseData, typeof payload>('/dict-keeper/external-crud/update', {
            method: 'PUT',
            body: payload,
          })
        : await requestData<DictKeeperExternalCrudItemResponseData, typeof payload>('/dict-keeper/external-crud/create', {
            method: 'POST',
            body: payload,
          })

      const record = data.item
      if (!record)
        throw new Error('后端未返回外部 CRUD 记录')

      const normalizedRecord = normalizeExternalCrudRecord(record)

      selectedExternalCrudId.value = normalizedRecord._id || DEFAULT_EXTERNAL_CRUD_ID
      setLoadedSnapshot(normalizedRecord)
      applyRecord(normalizedRecord)
      externalCrudNameInput.value = normalizeExternalCrudName(normalizedRecord.name, normalizedRecord._id)

      await refreshExternalCrudList()
      const successText = shouldUpdateLoaded
        ? '外部 CRUD 更新成功。'
        : shouldUpdateByName
          ? '检测到同名外部 CRUD，已覆盖更新。'
          : '外部 CRUD 另存为新记录成功。'

      setNotice(successText, 'success')

      return normalizedRecord
    }
    catch (error) {
      setNotice(`保存外部 CRUD 失败：${toErrorMessage(error)}`, 'error')
      return null
    }
    finally {
      isSaving.value = false
    }
  }

  async function createExternalCrudFromCurrent() {
    clearValidationErrors()
    if (!validateForm()) {
      setNotice('请先修正表单校验错误后再新建。', 'error')
      return null
    }

    isSaving.value = true
    setNotice('', 'neutral')

    try {
      const normalizedInputName = normalizeText(externalCrudNameInput.value)
      const matchedByName = findExternalCrudByName(normalizedInputName)
      const shouldUpdateByName = Boolean(matchedByName)
      const nextId = shouldUpdateByName
        ? normalizeText(matchedByName?._id)
        : createExternalCrudId()

      const payload = {
        id: nextId,
        name: normalizeExternalCrudName(externalCrudNameInput.value, nextId),
        ...buildNormalizedFormPayload(),
      }

      const data = shouldUpdateByName
        ? await requestData<DictKeeperExternalCrudItemResponseData, typeof payload>('/dict-keeper/external-crud/update', {
            method: 'PUT',
            body: payload,
          })
        : await requestData<DictKeeperExternalCrudItemResponseData, typeof payload>('/dict-keeper/external-crud/create', {
            method: 'POST',
            body: payload,
          })

      const record = data.item
      if (!record)
        throw new Error('后端未返回外部 CRUD 记录')

      const normalizedRecord = normalizeExternalCrudRecord(record)

      selectedExternalCrudId.value = normalizedRecord._id || DEFAULT_EXTERNAL_CRUD_ID
      setLoadedSnapshot(normalizedRecord)
      applyRecord(normalizedRecord)
      externalCrudNameInput.value = normalizeExternalCrudName(normalizedRecord.name, normalizedRecord._id)

      await refreshExternalCrudList()
      setNotice(shouldUpdateByName ? '检测到同名外部 CRUD，已覆盖更新。' : '新外部 CRUD 创建成功。', 'success')

      return normalizedRecord
    }
    catch (error) {
      setNotice(`新建外部 CRUD 失败：${toErrorMessage(error)}`, 'error')
      return null
    }
    finally {
      isSaving.value = false
    }
  }

  async function deleteExternalCrud() {
    const targetId = normalizeText(loadedExternalCrudId.value)
    if (!targetId) {
      setNotice('当前没有可删除的外部 CRUD。', 'neutral')
      return null
    }

    isDeleting.value = true
    clearValidationErrors()
    setNotice('', 'neutral')

    try {
      const data = await requestData<DictKeeperExternalCrudItemResponseData, { id?: string }>('/dict-keeper/external-crud/delete', {
        method: 'DELETE',
        body: {
          id: targetId,
        },
      })

      const list = await refreshExternalCrudList()

      clearLoadedSnapshot()
      selectedExternalCrudId.value = ''
      resetForm()

      if (list.length === 0) {
        externalCrudNameInput.value = DEFAULT_EXTERNAL_CRUD_NAME
        setNotice('外部 CRUD 删除成功。', 'success')
        return data.item
      }

      const loadedDefault = await loadExternalCrudById(undefined, {
        silent: true,
        allowDefaultWhenIdEmpty: true,
      })

      if (loadedDefault)
        externalCrudNameInput.value = normalizeExternalCrudName(loadedDefault.name, loadedDefault._id)
      else
        externalCrudNameInput.value = ''

      setNotice('外部 CRUD 删除成功，已自动加载当前默认配置。', 'success')
      return data.item
    }
    catch (error) {
      setNotice(`删除外部 CRUD 失败：${toErrorMessage(error)}`, 'error')
      return null
    }
    finally {
      isDeleting.value = false
    }
  }

  async function executeExternalCrud(input: DictKeeperExternalCrudExecuteInput) {
    const normalizedId = normalizeText(input.id) || normalizeText(loadedExternalCrudId.value)

    isSaving.value = true
    clearValidationErrors()
    setNotice('', 'neutral')

    try {
      const data = await requestData<DictKeeperExternalCrudExecuteResponseData, DictKeeperExternalCrudExecuteInput>('/dict-keeper/external-crud/execute', {
        method: 'POST',
        body: {
          ...input,
          id: normalizedId || undefined,
        },
      })

      const result = data.result
      setNotice(`外部 CRUD 请求成功（HTTP ${result.status}）。`, 'success')
      return result
    }
    catch (error) {
      setNotice(`执行外部 CRUD 请求失败：${toErrorMessage(error)}`, 'error')
      return null
    }
    finally {
      isSaving.value = false
    }
  }

  function resetForm() {
    const defaults = createDefaultForm()

    form.basePath = defaults.basePath
    assignEndpointConfig(form.dictionary, defaults.dictionary)
    assignEndpointConfig(form.item, defaults.item)
  }

  const isBusy = computed(() => {
    return isListLoading.value || isLoading.value || isSaving.value || isDeleting.value || isSettingDefault.value
  })

  const state = {
    form,
    externalCrudNameInput,
    selectedExternalCrudId,
    externalCrudId,
    externalCrudList,
    currentConfigSnapshot,
    hasExternalCrud,
    isListLoading,
    isLoading,
    isSaving,
    isDeleting,
    isSettingDefault,
    isBusy,
    noticeText,
    noticeTone,
    validationErrors,
  }

  const actions = {
    initializeExternalCrud,
    refreshExternalCrudList,
    loadExternalCrud,
    loadExternalCrudById,
    setDefaultExternalCrud,
    selectExternalCrudAsDefault,
    saveExternalCrud,
    createExternalCrudFromCurrent,
    deleteExternalCrud,
    executeExternalCrud,
    resetForm,
  }

  return {
    state,
    actions,
  }

  function applyRecord(record: DictKeeperExternalCrudRecord) {
    form.basePath = normalizeText(record.basePath)

    assignEndpointConfig(form.dictionary, normalizeEndpointConfig(record.dictionary))
    assignEndpointConfig(form.item, normalizeEndpointConfig(record.item))

    syncCurrentConfigSnapshot(record)
  }

  function buildNormalizedFormPayload(): DictKeeperExternalCrudForm {
    return {
      basePath: normalizeText(form.basePath),
      dictionary: normalizeEndpointConfig(form.dictionary),
      item: normalizeEndpointConfig(form.item),
    }
  }

  function validateForm() {
    const errors: string[] = []
    const allowedMethodsLabel = REQUEST_METHOD_OPTIONS.join(' / ')

    if (normalizeText(externalCrudNameInput.value).length === 0)
      errors.push('外部 CRUD 名称不能为空')

    if (normalizeText(form.basePath).length === 0)
      errors.push('接口基础路径不能为空')

    const endpointEntries: Array<{ label: string, value: DictKeeperCrudEndpointNode }> = [
      { label: '字典-创建接口', value: form.dictionary.create },
      { label: '字典-读取接口', value: form.dictionary.read },
      { label: '字典-更新接口', value: form.dictionary.update },
      { label: '字典-删除接口', value: form.dictionary.delete },
      { label: '字典项-创建接口', value: form.item.create },
      { label: '字典项-读取接口', value: form.item.read },
      { label: '字典项-更新接口', value: form.item.update },
      { label: '字典项-删除接口', value: form.item.delete },
    ]

    for (const entry of endpointEntries) {
      if (normalizeText(entry.value.path).length === 0)
        errors.push(`${entry.label}路径不能为空`)

      const rawMethod = normalizeText(entry.value.method)
      if (!rawMethod) {
        errors.push(`${entry.label}请求方式不能为空`)
        continue
      }

      if (!REQUEST_METHOD_SET.has(rawMethod as DictKeeperRequestMethod))
        errors.push(`${entry.label}请求方式无效，仅支持：${allowedMethodsLabel}`)
    }

    validationErrors.value = errors
    return errors.length === 0
  }

  function clearValidationErrors() {
    validationErrors.value = []
  }

  function setNotice(text: string, tone: NoticeTone) {
    noticeText.value = text
    noticeTone.value = tone
  }

  function setLoadedSnapshot(record: DictKeeperExternalCrudRecord) {
    loadedExternalCrudId.value = normalizeText(record._id)
    loadedExternalCrudName.value = normalizeText(record.name)
    syncCurrentConfigSnapshot(record)
  }

  function clearLoadedSnapshot() {
    loadedExternalCrudId.value = ''
    loadedExternalCrudName.value = ''
    syncCurrentConfigSnapshot(null)
  }

  function syncCurrentConfigSnapshot(record: DictKeeperExternalCrudRecord | null) {
    currentConfigSnapshot.value = record
      ? toExternalCrudSnapshot(record)
      : null
  }

  function syncCurrentConfigSnapshotByList(list: DictKeeperExternalCrudRecord[]) {
    const current = currentConfigSnapshot.value
    if (!current) {
      const defaultRecord = list.find(item => item.isDefault === true)
      if (defaultRecord)
        syncCurrentConfigSnapshot(defaultRecord)

      return
    }

    const matched = list.find(item => normalizeText(item._id) === normalizeText(current.id))
    if (!matched)
      return

    syncCurrentConfigSnapshot(matched)
  }

  function findExternalCrudByName(name: string) {
    const normalized = normalizeText(name)
    if (!normalized)
      return null

    return externalCrudList.value.find(item => normalizeText(item.name) === normalized) ?? null
  }
}

async function requestData<TData, TBody = unknown>(
  path: string,
  options: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE'
    body?: TBody
  },
): Promise<TData> {
  const response = await withTimeout(
    request<TData, TBody>(path, options),
    REQUEST_TIMEOUT_MS,
    `请求超时（${REQUEST_TIMEOUT_MS}ms）：${path}`,
  )

  if (response.ok)
    return response.data

  const errorCode = response.error.code ? `[${response.error.code}] ` : ''
  throw new Error(`${errorCode}${response.error.message}`)
}

function withTimeout<TData>(promise: Promise<TData>, timeoutMs: number, message: string): Promise<TData> {
  return new Promise<TData>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(message))
    }, timeoutMs)

    promise
      .then((data) => {
        clearTimeout(timer)
        resolve(data)
      })
      .catch((error) => {
        clearTimeout(timer)
        reject(error)
      })
  })
}

function createDefaultForm(): DictKeeperExternalCrudForm {
  return {
    basePath: '',
    dictionary: createDefaultEndpointConfig(),
    item: createDefaultEndpointConfig(),
  }
}

function createDefaultEndpointConfig(): DictKeeperCrudEndpointConfig {
  return {
    create: createDefaultEndpointNode(),
    read: createDefaultEndpointNode(),
    update: createDefaultEndpointNode(),
    delete: createDefaultEndpointNode(),
  }
}

function createDefaultEndpointNode(): DictKeeperCrudEndpointNode {
  return {
    path: '',
    method: '',
    pathTemplate: undefined,
    queryTemplate: undefined,
    headerTemplate: undefined,
    bodyTemplate: undefined,
    contentType: undefined,
    timeoutMs: undefined,
    mergeStrategy: '',
  }
}

function normalizeExternalCrudRecord(record: DictKeeperExternalCrudRecord): DictKeeperExternalCrudRecord {
  const normalizedId = normalizeText(record._id)

  return {
    _id: normalizedId,
    name: normalizeExternalCrudName(record.name, normalizedId),
    basePath: normalizeText(record.basePath),
    dictionary: normalizeEndpointConfig(record.dictionary),
    item: normalizeEndpointConfig(record.item),
    isDefault: record.isDefault === true,
    isDeleted: record.isDeleted === true ? true : undefined,
    deletedAt: toOptionalTimestamp(record.deletedAt),
    createdAt: toOptionalTimestamp(record.createdAt),
    updatedAt: toOptionalTimestamp(record.updatedAt),
  }
}

function toExternalCrudSnapshot(record: DictKeeperExternalCrudRecord): DictKeeperExternalCrudSnapshot {
  const normalizedRecord = normalizeExternalCrudRecord(record)

  return {
    id: normalizedRecord._id,
    name: normalizedRecord.name,
    basePath: normalizedRecord.basePath,
    dictionary: normalizedRecord.dictionary,
    item: normalizedRecord.item,
    isDefault: normalizedRecord.isDefault === true,
    createdAt: normalizedRecord.createdAt,
    updatedAt: normalizedRecord.updatedAt,
  }
}

function toOptionalTimestamp(value: unknown) {
  const timestamp = toTimestamp(value)
  if (timestamp <= 0)
    return undefined

  return timestamp
}

function normalizeEndpointConfig(input: unknown): DictKeeperCrudEndpointConfig {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return createDefaultEndpointConfig()

  const source = input as Record<string, unknown>

  return {
    create: normalizeEndpointNode(source.create),
    read: normalizeEndpointNode(source.read),
    update: normalizeEndpointNode(source.update),
    delete: normalizeEndpointNode(source.delete),
  }
}

function normalizeEndpointNode(input: unknown): DictKeeperCrudEndpointNode {
  if (typeof input === 'string') {
    return {
      path: normalizeText(input),
      method: '',
      pathTemplate: undefined,
      queryTemplate: undefined,
      headerTemplate: undefined,
      bodyTemplate: undefined,
      contentType: undefined,
      timeoutMs: undefined,
      mergeStrategy: '',
    }
  }

  if (!input || typeof input !== 'object' || Array.isArray(input))
    return createDefaultEndpointNode()

  const source = input as Record<string, unknown>

  return {
    path: normalizeText(source.path),
    method: normalizeRequestMethodInput(source.method),
    pathTemplate: normalizeOptionalText(source.pathTemplate),
    queryTemplate: normalizeTemplateRecord(source.queryTemplate),
    headerTemplate: normalizeTemplateRecord(source.headerTemplate),
    bodyTemplate: cloneTemplateValue(source.bodyTemplate),
    contentType: normalizeOptionalText(source.contentType),
    timeoutMs: normalizeOptionalTimeout(source.timeoutMs),
    mergeStrategy: normalizeEndpointMergeStrategyInput(source.mergeStrategy),
  }
}

function normalizeRequestMethodInput(input: unknown): DictKeeperRequestMethodInput {
  if (typeof input !== 'string')
    return ''

  const normalized = input.trim().toUpperCase()
  if (!REQUEST_METHOD_SET.has(normalized as DictKeeperRequestMethod))
    return ''

  return normalized as DictKeeperRequestMethod
}

function normalizeEndpointMergeStrategyInput(input: unknown): DictKeeperEndpointMergeStrategy | '' {
  if (typeof input !== 'string')
    return ''

  const normalized = input.trim()
  if (!normalized)
    return ''

  if (!ENDPOINT_MERGE_STRATEGY_OPTIONS.includes(normalized as DictKeeperEndpointMergeStrategy))
    return ''

  return normalized as DictKeeperEndpointMergeStrategy
}

function normalizeTemplateRecord(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return undefined

  const source = input as Record<string, unknown>
  const normalized: Record<string, string> = {}

  for (const [rawKey, rawValue] of Object.entries(source)) {
    const key = normalizeText(rawKey)
    if (!key || typeof rawValue !== 'string')
      continue

    const value = rawValue.trim()
    if (!value)
      continue

    normalized[key] = value
  }

  if (Object.keys(normalized).length === 0)
    return undefined

  return normalized
}

function cloneTemplateValue(input: unknown): unknown {
  if (input === undefined)
    return undefined

  if (input === null)
    return null

  if (typeof input === 'string' || typeof input === 'number' || typeof input === 'boolean')
    return input

  if (Array.isArray(input))
    return input.map(item => cloneTemplateValue(item))

  if (typeof input === 'object') {
    const source = input as Record<string, unknown>
    const normalized: Record<string, unknown> = {}

    for (const [rawKey, rawValue] of Object.entries(source)) {
      const key = normalizeText(rawKey)
      if (!key)
        continue

      normalized[key] = cloneTemplateValue(rawValue)
    }

    return normalized
  }

  return undefined
}

function normalizeOptionalTimeout(input: unknown) {
  if (typeof input !== 'number' || !Number.isFinite(input))
    return undefined

  const normalized = Math.trunc(input)
  if (normalized <= 0)
    return undefined

  return normalized
}

function normalizeOptionalText(input: unknown) {
  const normalized = normalizeText(input)
  if (!normalized)
    return undefined

  return normalized
}

function assignEndpointConfig(
  target: DictKeeperCrudEndpointConfig,
  source: DictKeeperCrudEndpointConfig,
) {
  assignEndpointNode(target.create, source.create)
  assignEndpointNode(target.read, source.read)
  assignEndpointNode(target.update, source.update)
  assignEndpointNode(target.delete, source.delete)
}

function assignEndpointNode(
  target: DictKeeperCrudEndpointNode,
  source: DictKeeperCrudEndpointNode,
) {
  target.path = source.path
  target.method = source.method
  target.pathTemplate = source.pathTemplate
  target.queryTemplate = source.queryTemplate ? { ...source.queryTemplate } : undefined
  target.headerTemplate = source.headerTemplate ? { ...source.headerTemplate } : undefined
  target.bodyTemplate = cloneTemplateValue(source.bodyTemplate)
  target.contentType = source.contentType
  target.timeoutMs = source.timeoutMs
  target.mergeStrategy = source.mergeStrategy ?? ''
}

function normalizeText(input: unknown) {
  if (typeof input !== 'string')
    return ''

  return input.trim()
}

function normalizeExternalCrudName(input: unknown, id: string) {
  const normalized = normalizeText(input)
  if (normalized)
    return normalized

  if (id === DEFAULT_EXTERNAL_CRUD_ID)
    return DEFAULT_EXTERNAL_CRUD_NAME

  return buildTimestampExternalCrudName()
}

function buildTimestampExternalCrudName() {
  const now = new Date()
  const pad2 = (value: number) => String(value).padStart(2, '0')

  return `外部CRUD ${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`
}

function createExternalCrudId() {
  if (typeof globalThis.crypto?.randomUUID === 'function')
    return globalThis.crypto.randomUUID()

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function compareByRecent(left: DictKeeperExternalCrudRecord, right: DictKeeperExternalCrudRecord) {
  const updatedGap = toTimestamp(right.updatedAt) - toTimestamp(left.updatedAt)
  if (updatedGap !== 0)
    return updatedGap

  const createdGap = toTimestamp(right.createdAt) - toTimestamp(left.createdAt)
  if (createdGap !== 0)
    return createdGap

  return left._id.localeCompare(right._id)
}

function toTimestamp(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value))
    return 0

  return value
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error)
    return error.message

  return '未知错误'
}
