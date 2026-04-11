import { request } from '~/shared/composables/useRouterRequest'

type NoticeTone = 'neutral' | 'success' | 'error'

export interface DictKeeperCrudEndpointConfig {
  create: string
  read: string
  update: string
  delete: string
}

export interface DictKeeperConfigForm {
  basePath: string
  dictionary: DictKeeperCrudEndpointConfig
  item: DictKeeperCrudEndpointConfig
}

export interface DictKeeperConfigRecord extends DictKeeperConfigForm {
  _id: string
  name: string
  isDeleted?: boolean
  deletedAt?: number
  createdAt?: number
  updatedAt?: number
}

interface DictKeeperConfigItemResponseData {
  item: DictKeeperConfigRecord | null
}

interface DictKeeperConfigListResponseData {
  items: DictKeeperConfigRecord[]
}

const DEFAULT_CONFIG_ID = 'dict-keeper-global-config'
const DEFAULT_CONFIG_NAME = '默认配置'

interface LoadConfigOptions {
  silent?: boolean
}

export function useDictKeeperConfig() {
  const form = reactive<DictKeeperConfigForm>(createDefaultForm())
  const selectedConfigId = ref('')
  const configNameInput = ref('')
  const configsList = ref<DictKeeperConfigRecord[]>([])
  const loadedConfigId = ref('')
  const loadedConfigName = ref('')

  const configId = computed(() => loadedConfigId.value)

  const hasConfig = computed(() => loadedConfigId.value.length > 0)
  const isListLoading = ref(false)
  const isLoading = ref(false)
  const isSaving = ref(false)
  const isDeleting = ref(false)

  const validationErrors = ref<string[]>([])
  const noticeText = ref('')
  const noticeTone = ref<NoticeTone>('neutral')

  async function refreshConfigList() {
    isListLoading.value = true

    try {
      const data = await requestData<DictKeeperConfigListResponseData, { includeDeleted?: boolean }>('/dict-keeper/config.list', {
        method: 'GET',
        body: {
          includeDeleted: false,
        },
      })

      const normalizedItems = [...data.items].sort(compareByRecent)
      configsList.value = normalizedItems

      if (normalizedItems.length === 0) {
        selectedConfigId.value = ''
        clearLoadedSnapshot()
        return []
      }

      const selectedExists = normalizedItems.some(item => item._id === selectedConfigId.value)
      if (!selectedExists)
        selectedConfigId.value = ''

      const loadedExists = normalizedItems.some(item => item._id === loadedConfigId.value)
      if (!loadedExists)
        clearLoadedSnapshot()

      return normalizedItems
    }
    catch (error) {
      setNotice(`刷新配置列表失败：${toErrorMessage(error)}`, 'error')
      return []
    }
    finally {
      isListLoading.value = false
    }
  }

  async function loadConfig() {
    clearValidationErrors()
    setNotice('', 'neutral')

    selectedConfigId.value = ''
    clearLoadedSnapshot()
    resetForm()
    configNameInput.value = ''

    const list = await refreshConfigList()
    if (list.length === 0) {
      resetForm()
      configNameInput.value = DEFAULT_CONFIG_NAME

      if (noticeTone.value !== 'error')
        setNotice('尚未创建后端配置，请先新建配置。', 'neutral')

      return null
    }

    setNotice('请先从列表选择一个配置并加载。', 'neutral')
    return null
  }

  async function loadConfigById(id: string | undefined, options: LoadConfigOptions = {}) {
    const targetId = normalizeText(id)
    if (!targetId) {
      clearLoadedSnapshot()

      if (!options.silent)
        setNotice('请先从配置列表中选择一项。', 'neutral')

      return null
    }

    isLoading.value = true
    clearValidationErrors()

    if (!options.silent)
      setNotice('', 'neutral')

    try {
      const data = await requestData<DictKeeperConfigItemResponseData, { id?: string, includeDeleted?: boolean }>(
        '/dict-keeper/config.read',
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
        selectedConfigId.value = ''
        clearLoadedSnapshot()
        resetForm()
        configNameInput.value = ''

        if (!options.silent)
          setNotice('未找到所选配置，请刷新列表后重试。', 'error')

        return null
      }

      selectedConfigId.value = record._id || DEFAULT_CONFIG_ID
      setLoadedSnapshot(record)
      applyRecord(record)
      configNameInput.value = normalizeConfigName(record.name, record._id)

      if (!options.silent)
        setNotice('已加载所选配置。', 'success')

      return record
    }
    catch (error) {
      if (!options.silent)
        setNotice(`加载配置失败：${toErrorMessage(error)}`, 'error')

      return null
    }
    finally {
      isLoading.value = false
    }
  }

  async function saveConfig() {
    clearValidationErrors()
    if (!validateForm()) {
      setNotice('请先修正表单校验错误后再保存。', 'error')
      return null
    }

    const normalizedInputName = normalizeText(configNameInput.value)
    const normalizedLoadedId = normalizeText(loadedConfigId.value)
    const normalizedLoadedName = normalizeText(loadedConfigName.value)
    const loadedExistsInList = normalizedLoadedId.length > 0
      && configsList.value.some(item => item._id === normalizedLoadedId)

    const matchedConfigByName = findConfigByName(normalizedInputName)

    const shouldUpdateLoaded = loadedExistsInList
      && normalizedInputName.length > 0
      && normalizedInputName === normalizedLoadedName

    const shouldUpdateByName = !shouldUpdateLoaded && Boolean(matchedConfigByName)
    const shouldUpdate = shouldUpdateLoaded || shouldUpdateByName
    const updateTargetId = shouldUpdateLoaded
      ? normalizedLoadedId
      : normalizeText(matchedConfigByName?._id)

    const nextId = shouldUpdate ? updateTargetId : createConfigId()

    isSaving.value = true
    setNotice('', 'neutral')

    try {
      const payload = {
        id: nextId,
        name: normalizeConfigName(configNameInput.value, nextId),
        ...buildNormalizedFormPayload(),
      }

      const data = shouldUpdate
        ? await requestData<DictKeeperConfigItemResponseData, typeof payload>('/dict-keeper/config.update', {
            method: 'PUT',
            body: payload,
          })
        : await requestData<DictKeeperConfigItemResponseData, typeof payload>('/dict-keeper/config.create', {
            method: 'POST',
            body: payload,
          })

      const record = data.item
      if (!record)
        throw new Error('后端未返回配置记录')

      selectedConfigId.value = record._id || DEFAULT_CONFIG_ID
      setLoadedSnapshot(record)
      applyRecord(record)
      configNameInput.value = normalizeConfigName(record.name, record._id)

      await refreshConfigList()
      const successText = shouldUpdateLoaded
        ? '配置更新成功。'
        : shouldUpdateByName
          ? '检测到同名配置，已覆盖更新。'
          : '配置另存为新配置成功。'

      setNotice(successText, 'success')

      return record
    }
    catch (error) {
      setNotice(`保存配置失败：${toErrorMessage(error)}`, 'error')
      return null
    }
    finally {
      isSaving.value = false
    }
  }

  async function createConfigFromCurrent() {
    clearValidationErrors()
    if (!validateForm()) {
      setNotice('请先修正表单校验错误后再新建。', 'error')
      return null
    }

    isSaving.value = true
    setNotice('', 'neutral')

    try {
      const normalizedInputName = normalizeText(configNameInput.value)
      const matchedConfigByName = findConfigByName(normalizedInputName)
      const shouldUpdateByName = Boolean(matchedConfigByName)
      const nextId = shouldUpdateByName
        ? normalizeText(matchedConfigByName?._id)
        : createConfigId()

      const payload = {
        id: nextId,
        name: normalizeConfigName(configNameInput.value, nextId),
        ...buildNormalizedFormPayload(),
      }

      const data = shouldUpdateByName
        ? await requestData<DictKeeperConfigItemResponseData, typeof payload>('/dict-keeper/config.update', {
            method: 'PUT',
            body: payload,
          })
        : await requestData<DictKeeperConfigItemResponseData, typeof payload>('/dict-keeper/config.create', {
            method: 'POST',
            body: payload,
          })

      const record = data.item
      if (!record)
        throw new Error('后端未返回配置记录')

      selectedConfigId.value = record._id || DEFAULT_CONFIG_ID
      setLoadedSnapshot(record)
      applyRecord(record)
      configNameInput.value = normalizeConfigName(record.name, record._id)

      await refreshConfigList()
      setNotice(shouldUpdateByName ? '检测到同名配置，已覆盖更新。' : '新配置创建成功。', 'success')

      return record
    }
    catch (error) {
      setNotice(`新建配置失败：${toErrorMessage(error)}`, 'error')
      return null
    }
    finally {
      isSaving.value = false
    }
  }

  async function deleteConfig() {
    const targetId = normalizeText(loadedConfigId.value)
    if (!targetId) {
      setNotice('当前没有可删除的配置。', 'neutral')
      return null
    }

    isDeleting.value = true
    clearValidationErrors()
    setNotice('', 'neutral')

    try {
      const data = await requestData<DictKeeperConfigItemResponseData, { id?: string }>('/dict-keeper/config.delete', {
        method: 'DELETE',
        body: {
          id: targetId,
        },
      })

      const list = await refreshConfigList()

      clearLoadedSnapshot()
      selectedConfigId.value = ''
      resetForm()

      if (list.length === 0) {
        configNameInput.value = DEFAULT_CONFIG_NAME
      }
      else {
        configNameInput.value = ''
      }

      setNotice('配置删除成功。', 'success')
      return data.item
    }
    catch (error) {
      setNotice(`删除配置失败：${toErrorMessage(error)}`, 'error')
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
    configNameInput,
    selectedConfigId,
    configId,
    configsList,
    hasConfig,
    isListLoading,
    isLoading,
    isSaving,
    isDeleting,
    isBusy,
    noticeText,
    noticeTone,
    validationErrors,
    refreshConfigList,
    loadConfig,
    loadConfigById,
    saveConfig,
    createConfigFromCurrent,
    deleteConfig,
    resetForm,
  }

  function applyRecord(record: DictKeeperConfigRecord) {
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

  function buildNormalizedFormPayload(): DictKeeperConfigForm {
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
      { label: '配置名称', value: configNameInput.value },
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

  function setLoadedSnapshot(record: DictKeeperConfigRecord) {
    loadedConfigId.value = normalizeText(record._id)
    loadedConfigName.value = normalizeText(record.name)
  }

  function clearLoadedSnapshot() {
    loadedConfigId.value = ''
    loadedConfigName.value = ''
  }

  function findConfigByName(name: string) {
    const normalized = normalizeText(name)
    if (!normalized)
      return null

    return configsList.value.find(item => normalizeText(item.name) === normalized) ?? null
  }
}

async function requestData<TData, TBody = unknown>(
  path: string,
  options: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE'
    body?: TBody
  },
): Promise<TData> {
  const response = await request<TData, TBody>(path, options)
  if (response.ok)
    return response.data

  const errorCode = response.error.code ? `[${response.error.code}] ` : ''
  throw new Error(`${errorCode}${response.error.message}`)
}

function createDefaultForm(): DictKeeperConfigForm {
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

function normalizeConfigName(input: unknown, id: string) {
  const normalized = normalizeText(input)
  if (normalized)
    return normalized

  if (id === DEFAULT_CONFIG_ID)
    return DEFAULT_CONFIG_NAME

  return buildTimestampConfigName()
}

function buildTimestampConfigName() {
  const now = new Date()
  const pad2 = (value: number) => String(value).padStart(2, '0')

  return `配置 ${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`
}

function createConfigId() {
  if (typeof globalThis.crypto?.randomUUID === 'function')
    return globalThis.crypto.randomUUID()

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function compareByRecent(left: DictKeeperConfigRecord, right: DictKeeperConfigRecord) {
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
