import type {
  DictKeeperAuthInjectTarget,
  DictKeeperCrudAction,
  DictKeeperCrudSection,
  DictKeeperExternalCrudBusinessRule,
  DictKeeperExternalCrudExecuteInput,
} from '~/dict-keeper/composables/useDictKeeperExternalCrud'
import {
  FORBIDDEN_REQUEST_HEADER_NAMES,
  FORBIDDEN_REQUEST_HEADER_PREFIXES,
} from '~/import-pipeline/config/local.config'

type NoticeTone = 'neutral' | 'success' | 'error'

export const DICT_KEEPER_AUTH_INJECT_TARGET_OPTIONS: Array<{ label: string, value: DictKeeperAuthInjectTarget }> = [
  { label: '注入到 Header', value: 'header' },
  { label: '注入到 Params（Query）', value: 'params' },
  { label: '注入到 Data（Body）', value: 'data' },
]

export const DICT_KEEPER_AUTH_SECTION_OPTIONS: Array<{ label: string, value: DictKeeperCrudSection }> = [
  { label: '数据字典（dictionary）', value: 'dictionary' },
  { label: '字典项（item）', value: 'item' },
]

export const DICT_KEEPER_AUTH_ACTION_OPTIONS: Array<{ label: string, value: DictKeeperCrudAction }> = [
  { label: '创建（create）', value: 'create' },
  { label: '读取（read）', value: 'read' },
  { label: '更新（update）', value: 'update' },
  { label: '删除（delete）', value: 'delete' },
]

const DEFAULT_SUCCESS_FIELD_PATH = ''
const DEFAULT_SUCCESS_EXPECTED_VALUE_TEXT = ''
const DEFAULT_PAYLOAD_JSON_TEXT = ''

let sharedDictKeeperAuthConfigStore: ReturnType<typeof createDictKeeperAuthConfigStore> | null = null

export function useDictKeeperAuthConfig() {
  if (sharedDictKeeperAuthConfigStore)
    return sharedDictKeeperAuthConfigStore

  sharedDictKeeperAuthConfigStore = createDictKeeperAuthConfigStore()
  return sharedDictKeeperAuthConfigStore
}

function createDictKeeperAuthConfigStore() {
  const authJsonText = ref('')
  const injectTarget = ref<DictKeeperAuthInjectTarget>('header')
  const successFieldPath = ref(DEFAULT_SUCCESS_FIELD_PATH)
  const successExpectedValueText = ref(DEFAULT_SUCCESS_EXPECTED_VALUE_TEXT)

  const section = ref<DictKeeperCrudSection>('dictionary')
  const action = ref<DictKeeperCrudAction>('read')
  const payloadJsonText = ref(DEFAULT_PAYLOAD_JSON_TEXT)

  const validationErrors = ref<string[]>([])
  const noticeText = ref('')
  const noticeTone = ref<NoticeTone>('neutral')

  const hasAuthJson = computed(() => normalizeText(authJsonText.value).length > 0)

  const currentSummary = computed(() => {
    const targetLabel = DICT_KEEPER_AUTH_INJECT_TARGET_OPTIONS.find(item => item.value === injectTarget.value)?.label ?? injectTarget.value
    const rulePath = normalizeText(successFieldPath.value) || '(未设置字段路径)'
    const expectedLabel = normalizeText(successExpectedValueText.value) || '(未设置期望值)'

    return `${targetLabel} · 业务判定 ${rulePath} === ${expectedLabel}`
  })

  const noticeClass = computed(() => {
    if (noticeTone.value === 'success')
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'

    if (noticeTone.value === 'error')
      return 'border-rose-200 bg-rose-50 text-rose-700'

    return 'border-slate-200 bg-slate-50 text-slate-600'
  })

  function resetConfig() {
    authJsonText.value = ''
    injectTarget.value = 'header'
    successFieldPath.value = DEFAULT_SUCCESS_FIELD_PATH
    successExpectedValueText.value = DEFAULT_SUCCESS_EXPECTED_VALUE_TEXT
    section.value = 'dictionary'
    action.value = 'read'
    payloadJsonText.value = DEFAULT_PAYLOAD_JSON_TEXT
    clearValidationErrors()
    setNotice('', 'neutral')
  }

  function buildExecuteInput(): DictKeeperExternalCrudExecuteInput | null {
    clearValidationErrors()
    setNotice('', 'neutral')

    const authDataResult = parseAuthData()
    if (!authDataResult.ok) {
      validationErrors.value = authDataResult.errors
      setNotice('鉴权 JSON 校验失败，请修正后重试。', 'error')
      return null
    }

    const payloadResult = parsePayload()
    if (!payloadResult.ok) {
      validationErrors.value = payloadResult.errors
      setNotice('请求数据 JSON 校验失败，请修正后重试。', 'error')
      return null
    }

    const businessRuleResult = parseBusinessRule()
    if (!businessRuleResult.ok) {
      validationErrors.value = businessRuleResult.errors
      setNotice('业务响应码校验规则不完整，请修正后重试。', 'error')
      return null
    }

    return {
      section: section.value,
      action: action.value,
      payload: payloadResult.payload,
      authData: authDataResult.authData,
      injectTarget: injectTarget.value,
      successRule: businessRuleResult.successRule,
    }
  }

  function setExecutionSuccessNotice(status: number) {
    setNotice(`执行成功（HTTP ${status}），业务响应码判定通过。`, 'success')
  }

  function setExecutionErrorNotice(message: string) {
    const normalizedMessage = normalizeText(message) || '执行失败'
    setNotice(normalizedMessage, 'error')
  }

  function parseAuthData():
    | { ok: true, authData: Record<string, unknown> }
    | { ok: false, errors: string[] } {
    const sourceText = normalizeText(authJsonText.value)
    if (!sourceText)
      return { ok: true, authData: {} }

    const parsed = safeParseJson(sourceText, '鉴权数据 JSON')
    if (!parsed.ok)
      return parsed

    if (!isPlainRecord(parsed.value)) {
      return {
        ok: false,
        errors: ['鉴权数据 JSON 必须是对象（例如 {"token":"abc"}）。'],
      }
    }

    if (injectTarget.value === 'header') {
      const blockedHeaderNames = collectBlockedHeaderNames(parsed.value)
      if (blockedHeaderNames.length > 0) {
        return {
          ok: false,
          errors: [`以下请求头受浏览器限制，不能注入：${blockedHeaderNames.join('、')}`],
        }
      }
    }

    return {
      ok: true,
      authData: parsed.value,
    }
  }

  function parsePayload():
    | { ok: true, payload: unknown }
    | { ok: false, errors: string[] } {
    const sourceText = normalizeText(payloadJsonText.value)
    if (!sourceText)
      return { ok: true, payload: {} }

    const parsed = safeParseJson(sourceText, '请求数据 JSON')
    if (!parsed.ok)
      return parsed

    return {
      ok: true,
      payload: parsed.value,
    }
  }

  function parseBusinessRule():
    | { ok: true, successRule: DictKeeperExternalCrudBusinessRule }
    | { ok: false, errors: string[] } {
    const path = normalizeText(successFieldPath.value)
    if (!path) {
      return {
        ok: false,
        errors: ['业务响应字段路径不能为空（例如 data.code 或 code）。'],
      }
    }

    const rawExpectedValue = normalizeText(successExpectedValueText.value)
    if (!rawExpectedValue) {
      return {
        ok: false,
        errors: ['业务响应期望值不能为空。'],
      }
    }

    const expectedValue = parseExpectedValue(rawExpectedValue)

    const successRule: DictKeeperExternalCrudBusinessRule = {
      fieldPath: path,
      expectedValue,
    }

    return {
      ok: true,
      successRule,
    }
  }

  function parseExpectedValue(rawInput: string): unknown {
    try {
      return JSON.parse(rawInput)
    }
    catch {
      return rawInput
    }
  }

  function clearValidationErrors() {
    validationErrors.value = []
  }

  function setNotice(text: string, tone: NoticeTone) {
    noticeText.value = text
    noticeTone.value = tone
  }

  const state = {
    authJsonText,
    injectTarget,
    successFieldPath,
    successExpectedValueText,
    section,
    action,
    payloadJsonText,
    validationErrors,
    noticeText,
    noticeTone,
    noticeClass,
    currentSummary,
    hasAuthJson,
  }

  const actions = {
    resetConfig,
    buildExecuteInput,
    setExecutionSuccessNotice,
    setExecutionErrorNotice,
  }

  return {
    state,
    actions,
  }
}

function safeParseJson(
  text: string,
  label: string,
):
  | { ok: true, value: unknown }
  | { ok: false, errors: string[] } {
  try {
    return {
      ok: true,
      value: JSON.parse(text),
    }
  }
  catch (error) {
    return {
      ok: false,
      errors: [`${label} 解析失败：${toErrorMessage(error)}`],
    }
  }
}

function collectBlockedHeaderNames(source: Record<string, unknown>) {
  const blocked: string[] = []

  for (const key of Object.keys(source)) {
    const trimmedKey = key.trim()
    if (!trimmedKey)
      continue

    if (isForbiddenRequestHeaderName(trimmedKey))
      blocked.push(trimmedKey)
  }

  return blocked
}

function isForbiddenRequestHeaderName(headerName: string) {
  const lowerName = headerName.toLowerCase()
  if (FORBIDDEN_REQUEST_HEADER_NAMES.has(lowerName))
    return true

  for (const prefix of FORBIDDEN_REQUEST_HEADER_PREFIXES) {
    if (lowerName.startsWith(prefix))
      return true
  }

  return false
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object')
    return false

  return !Array.isArray(value)
}

function normalizeText(input: unknown) {
  if (typeof input !== 'string')
    return ''

  return input.trim()
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error)
    return error.message

  return '未知错误'
}
