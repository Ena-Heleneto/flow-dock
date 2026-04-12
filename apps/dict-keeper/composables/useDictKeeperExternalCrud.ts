import { request } from '~/shared/composables/useRouterRequest'

type NoticeTone = 'neutral' | 'success' | 'error'

export interface DictKeeperCrudEndpointConfig {
  create: string
  read: string
  update: string
  delete: string
}

export interface DictKeeperExternalCrudForm {
  basePath: string
  dictionary: DictKeeperCrudEndpointConfig
  item: DictKeeperCrudEndpointConfig
}

export interface DictKeeperExternalCrudRecord extends DictKeeperExternalCrudForm {
  _id: string
  name: string
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

const DEFAULT_EXTERNAL_CRUD_ID = 'dict-keeper-global-external-crud'
const DEFAULT_EXTERNAL_CRUD_NAME = '默认外部 CRUD'
const REQUEST_TIMEOUT_MS = 12000

interface LoadExternalCrudOptions {
  silent?: boolean
}

export function useDictKeeperExternalCrud() {
  const form = reactive<DictKeeperExternalCrudForm>(createDefaultForm())
  const selectedExternalCrudId = ref('')
  const externalCrudNameInput = ref('')
  const externalCrudList = ref<DictKeeperExternalCrudRecord[]>([])
  const loadedExternalCrudId = ref('')
  const loadedExternalCrudName = ref('')

  const externalCrudId = computed(() => loadedExternalCrudId.value)

  const hasExternalCrud = computed(() => loadedExternalCrudId.value.length > 0)
  const isListLoading = ref(false)
  const isLoading = ref(false)
  const isSaving = ref(false)
  const isDeleting = ref(false)

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

      const normalizedItems = [...data.items].sort(compareByRecent)
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

  async function loadExternalCrud() {
    clearValidationErrors()
    setNotice('', 'neutral')

    selectedExternalCrudId.value = ''
    clearLoadedSnapshot()
    resetForm()
    externalCrudNameInput.value = ''

    const list = await refreshExternalCrudList()
    if (list.length === 0) {
      resetForm()
      externalCrudNameInput.value = DEFAULT_EXTERNAL_CRUD_NAME

      if (noticeTone.value !== 'error')
        setNotice('尚未创建外部 CRUD，请先新建。', 'neutral')

      return null
    }

    setNotice('请先从列表选择一个外部 CRUD 并加载。', 'neutral')
    return null
  }

  async function loadExternalCrudById(id: string | undefined, options: LoadExternalCrudOptions = {}) {
    const targetId = normalizeText(id)
    if (!targetId) {
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
          body: {
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
        externalCrudNameInput.value = ''

        if (!options.silent)
          setNotice('未找到所选外部 CRUD，请刷新列表后重试。', 'error')

        return null
      }

      selectedExternalCrudId.value = record._id || DEFAULT_EXTERNAL_CRUD_ID
      setLoadedSnapshot(record)
      applyRecord(record)
      externalCrudNameInput.value = normalizeExternalCrudName(record.name, record._id)

      if (!options.silent)
        setNotice('已加载所选外部 CRUD。', 'success')

      return record
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

      selectedExternalCrudId.value = record._id || DEFAULT_EXTERNAL_CRUD_ID
      setLoadedSnapshot(record)
      applyRecord(record)
      externalCrudNameInput.value = normalizeExternalCrudName(record.name, record._id)

      await refreshExternalCrudList()
      const successText = shouldUpdateLoaded
        ? '外部 CRUD 更新成功。'
        : shouldUpdateByName
          ? '检测到同名外部 CRUD，已覆盖更新。'
          : '外部 CRUD 另存为新记录成功。'

      setNotice(successText, 'success')

      return record
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

      selectedExternalCrudId.value = record._id || DEFAULT_EXTERNAL_CRUD_ID
      setLoadedSnapshot(record)
      applyRecord(record)
      externalCrudNameInput.value = normalizeExternalCrudName(record.name, record._id)

      await refreshExternalCrudList()
      setNotice(shouldUpdateByName ? '检测到同名外部 CRUD，已覆盖更新。' : '新外部 CRUD 创建成功。', 'success')

      return record
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

      if (list.length === 0)
        externalCrudNameInput.value = DEFAULT_EXTERNAL_CRUD_NAME
      else
        externalCrudNameInput.value = ''

      setNotice('外部 CRUD 删除成功。', 'success')
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

  function resetForm() {
    const defaults = createDefaultForm()

    form.basePath = defaults.basePath
    form.dictionary.create = defaults.dictionary.create
    form.dictionary.read = defaults.dictionary.read
    form.dictionary.update = defaults.dictionary.update
    form.dictionary.delete = defaults.dictionary.delete
    form.item.create = defaults.item.create
    form.item.read = defaults.item.read
    form.item.update = defaults.item.update
    form.item.delete = defaults.item.delete
  }

  const isBusy = computed(() => {
    return isListLoading.value || isLoading.value || isSaving.value || isDeleting.value
  })

  return {
    form,
    externalCrudNameInput,
    selectedExternalCrudId,
    externalCrudId,
    externalCrudList,
    hasExternalCrud,
    isListLoading,
    isLoading,
    isSaving,
    isDeleting,
    isBusy,
    noticeText,
    noticeTone,
    validationErrors,
    refreshExternalCrudList,
    loadExternalCrud,
    loadExternalCrudById,
    saveExternalCrud,
    createExternalCrudFromCurrent,
    deleteExternalCrud,
    resetForm,
  }

  function applyRecord(record: DictKeeperExternalCrudRecord) {
    form.basePath = normalizeText(record.basePath)

    form.dictionary.create = normalizeText(record.dictionary?.create)
    form.dictionary.read = normalizeText(record.dictionary?.read)
    form.dictionary.update = normalizeText(record.dictionary?.update)
    form.dictionary.delete = normalizeText(record.dictionary?.delete)

    form.item.create = normalizeText(record.item?.create)
    form.item.read = normalizeText(record.item?.read)
    form.item.update = normalizeText(record.item?.update)
    form.item.delete = normalizeText(record.item?.delete)
  }

  function buildNormalizedFormPayload(): DictKeeperExternalCrudForm {
    return {
      basePath: normalizeText(form.basePath),
      dictionary: {
        create: normalizeText(form.dictionary.create),
        read: normalizeText(form.dictionary.read),
        update: normalizeText(form.dictionary.update),
        delete: normalizeText(form.dictionary.delete),
      },
      item: {
        create: normalizeText(form.item.create),
        read: normalizeText(form.item.read),
        update: normalizeText(form.item.update),
        delete: normalizeText(form.item.delete),
      },
    }
  }

  function validateForm() {
    const entries: Array<{ label: string, value: string }> = [
      { label: '外部 CRUD 名称', value: externalCrudNameInput.value },
      { label: '接口基础路径', value: form.basePath },
      { label: '字典-创建接口', value: form.dictionary.create },
      { label: '字典-读取接口', value: form.dictionary.read },
      { label: '字典-更新接口', value: form.dictionary.update },
      { label: '字典-删除接口', value: form.dictionary.delete },
      { label: '字典项-创建接口', value: form.item.create },
      { label: '字典项-读取接口', value: form.item.read },
      { label: '字典项-更新接口', value: form.item.update },
      { label: '字典项-删除接口', value: form.item.delete },
    ]

    const errors = entries
      .filter(entry => normalizeText(entry.value).length === 0)
      .map(entry => `${entry.label}不能为空`)

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
  }

  function clearLoadedSnapshot() {
    loadedExternalCrudId.value = ''
    loadedExternalCrudName.value = ''
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
    dictionary: {
      create: '',
      read: '',
      update: '',
      delete: '',
    },
    item: {
      create: '',
      read: '',
      update: '',
      delete: '',
    },
  }
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
