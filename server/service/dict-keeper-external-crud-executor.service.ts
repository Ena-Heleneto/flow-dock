import type {
  DictKeeperCrudEndpointNode,
  DictKeeperEndpointMergeStrategy,
  DictKeeperRequestMethod,
} from '@/schema/dict-keeper/external-crud.schema'
import { readDictKeeperExternalCrud } from '@/service/dict-keeper-external-crud.service'

export type DictKeeperCrudAction = 'create' | 'read' | 'update' | 'delete'
export type DictKeeperCrudSection = 'dictionary' | 'item'
export type DictKeeperAuthInjectTarget = 'header' | 'params' | 'data'

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
  contextData?: Record<string, unknown>
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

const CRUD_ACTIONS: DictKeeperCrudAction[] = ['create', 'read', 'update', 'delete']
const CRUD_SECTIONS: DictKeeperCrudSection[] = ['dictionary', 'item']
const INJECT_TARGETS: DictKeeperAuthInjectTarget[] = ['header', 'params', 'data']

const DEFAULT_TIMEOUT_MS = 15000
const MAX_TIMEOUT_MS = 60000
const DEFAULT_MERGE_STRATEGY: DictKeeperEndpointMergeStrategy = 'auth-overrides'

const METHOD_WITHOUT_BODY_SET = new Set<DictKeeperRequestMethod>(['GET'])
const ABSOLUTE_URL_RE = /^https?:\/\//i
const TEMPLATE_TOKEN_RE = /\{\{\s*([a-z_$][\w$.]*)\s*\}\}/gi
const SINGLE_TEMPLATE_TOKEN_RE = /^\s*\{\{\s*([a-z_$][\w$.]*)\s*\}\}\s*$/i

export async function executeDictKeeperExternalCrud(input: DictKeeperExternalCrudExecuteInput): Promise<DictKeeperExternalCrudExecuteResult> {
  const section = ensureCrudSection(input.section)
  const action = ensureCrudAction(input.action)
  const injectTarget = ensureInjectTarget(input.injectTarget)
  const timeoutMs = normalizeTimeout(input.timeoutMs)
  const authData = normalizeAuthData(input.authData)
  const contextData = normalizeContextData(input.contextData)

  const externalCrud = await readDictKeeperExternalCrud({
    id: normalizeText(input.id) || undefined,
    includeDeleted: false,
  })

  if (!externalCrud) {
    throw createServiceError(
      '未找到可执行的外部 CRUD 配置，请先在设置中创建并加载配置。',
      'DICT_KEEPER_EXTERNAL_CRUD_NOT_FOUND',
    )
  }

  const endpoint = externalCrud[section][action]
  const method = endpoint.method
  const basePath = normalizeText(externalCrud.basePath)

  const requestBuild = buildRequestConfig({
    basePath,
    endpoint,
    method,
    payload: input.payload,
    authData,
    contextData,
    injectTarget,
  })

  const effectiveTimeoutMs = requestBuild.timeoutMs ?? timeoutMs

  const startedAt = Date.now()
  const response = await requestWithTimeout(
    requestBuild.url,
    {
      method,
      headers: requestBuild.headers,
      body: requestBuild.body,
    },
    effectiveTimeoutMs,
  )

  const durationMs = Date.now() - startedAt
  const rawText = await response.text()
  const parsedResponse = tryParseJson(rawText)

  if (!response.ok) {
    throw createServiceError(
      `外部接口请求失败：HTTP ${response.status}`,
      'DICT_KEEPER_EXTERNAL_CRUD_HTTP_ERROR',
      {
        section,
        action,
        status: response.status,
        statusText: response.statusText,
        url: requestBuild.url,
        responseSnippet: rawText.slice(0, 500),
      },
    )
  }

  const businessEvaluation = evaluateBusinessRule(parsedResponse, input.successRule)
  if (!businessEvaluation.matched) {
    throw createServiceError(
      `业务响应码判定失败：${businessEvaluation.fieldPath} !== 期望值`,
      'DICT_KEEPER_EXTERNAL_CRUD_BUSINESS_CODE_MISMATCH',
      {
        section,
        action,
        fieldPath: businessEvaluation.fieldPath,
        expectedValue: businessEvaluation.expectedValue,
        actualValue: businessEvaluation.actualValue,
      },
    )
  }

  return {
    id: externalCrud._id,
    section,
    action,
    url: requestBuild.url,
    method,
    status: response.status,
    statusText: response.statusText,
    durationMs,
    injectTarget: requestBuild.injectTarget,
    business: {
      enabled: businessEvaluation.enabled,
      fieldPath: businessEvaluation.fieldPath,
      expectedValue: businessEvaluation.expectedValue,
      actualValue: businessEvaluation.actualValue,
    },
    response: {
      data: parsedResponse === undefined ? rawText : parsedResponse,
      rawText,
    },
  }
}

function buildRequestConfig(input: {
  basePath: string
  endpoint: DictKeeperCrudEndpointNode
  method: DictKeeperRequestMethod
  payload: unknown
  authData: Record<string, unknown>
  contextData: Record<string, unknown>
  injectTarget: DictKeeperAuthInjectTarget
}) {
  const templateContext = {
    payload: input.payload,
    auth: input.authData,
    context: input.contextData,
  }

  const headers = new Headers()
  const queryParams = new URLSearchParams()
  const mergeStrategy = ensureMergeStrategy(input.endpoint.mergeStrategy)

  const endpointPath = resolveEndpointPath(input.endpoint, templateContext)
  const endpointHeaderTemplate = renderTemplateRecord(input.endpoint.headerTemplate, templateContext, 'headerTemplate')
  const endpointQueryTemplate = renderTemplateRecord(input.endpoint.queryTemplate, templateContext, 'queryTemplate')

  appendRecordToHeaders(headers, endpointHeaderTemplate)
  appendRecordToSearchParams(queryParams, endpointQueryTemplate)

  let nextPayload = resolvePayloadWithTemplate(input.payload, input.endpoint.bodyTemplate, templateContext)
  let effectiveInjectTarget = input.injectTarget

  if (input.injectTarget === 'header')
    appendRecordToHeaders(headers, input.authData)

  if (input.injectTarget === 'params')
    appendRecordToSearchParams(queryParams, input.authData)

  if (input.injectTarget === 'data')
    nextPayload = mergePayloadWithAuthData(nextPayload, input.authData, mergeStrategy)

  if (METHOD_WITHOUT_BODY_SET.has(input.method)) {
    if (nextPayload !== undefined) {
      if (!isPlainRecord(nextPayload)) {
        throw createServiceError(
          `${input.method} 请求仅支持对象类型 payload（将自动转为 query 参数）`,
          'DICT_KEEPER_EXTERNAL_CRUD_PAYLOAD_TYPE_INVALID',
          { method: input.method },
        )
      }

      appendRecordToSearchParams(queryParams, nextPayload)
      nextPayload = undefined
    }

    if (input.injectTarget === 'data')
      effectiveInjectTarget = 'params'
  }

  const urlWithQuery = appendQuery(buildRequestUrl(input.basePath, endpointPath), queryParams)
  const body = buildRequestBody(nextPayload, input.endpoint.contentType)
  const contentType = normalizeText(input.endpoint.contentType)

  if (body) {
    if (contentType)
      headers.set('content-type', contentType)
    else if (!headers.has('content-type'))
      headers.set('content-type', 'application/json')
  }

  return {
    url: urlWithQuery,
    headers,
    body,
    injectTarget: effectiveInjectTarget,
    timeoutMs: normalizeOptionalTimeout(input.endpoint.timeoutMs),
  }
}

function resolveEndpointPath(
  endpoint: DictKeeperCrudEndpointNode,
  context: Record<string, unknown>,
) {
  const pathTemplate = normalizeText(endpoint.pathTemplate)
  const renderedPath = pathTemplate
    ? renderTemplateString(pathTemplate, context, 'pathTemplate')
    : normalizeText(endpoint.path)

  if (!renderedPath) {
    throw createServiceError(
      '外部 CRUD 接口路径缺失：endpoint.path/pathTemplate 至少应配置一项。',
      'DICT_KEEPER_EXTERNAL_CRUD_ENDPOINT_PATH_MISSING',
    )
  }

  return renderedPath
}

function resolvePayloadWithTemplate(
  payload: unknown,
  bodyTemplate: unknown,
  context: Record<string, unknown>,
) {
  if (bodyTemplate === undefined)
    return payload

  const templatePayload = renderTemplateValue(bodyTemplate, context, 'bodyTemplate')

  if (payload === undefined)
    return templatePayload

  if (isPlainRecord(templatePayload) && isPlainRecord(payload)) {
    return {
      ...templatePayload,
      ...payload,
    }
  }

  return payload
}

function renderTemplateRecord(
  templateRecord: Record<string, string> | undefined,
  context: Record<string, unknown>,
  fieldPath: string,
) {
  if (!templateRecord)
    return {}

  const rendered: Record<string, unknown> = {}
  for (const [rawKey, rawTemplate] of Object.entries(templateRecord)) {
    const key = normalizeText(rawKey)
    if (!key)
      continue

    rendered[key] = renderTemplateString(rawTemplate, context, `${fieldPath}.${key}`)
  }

  return rendered
}

function renderTemplateValue(
  input: unknown,
  context: Record<string, unknown>,
  fieldPath: string,
): unknown {
  if (input === undefined)
    return undefined

  if (input === null)
    return null

  if (typeof input === 'string') {
    const singleToken = input.match(SINGLE_TEMPLATE_TOKEN_RE)
    if (singleToken)
      return resolveTemplateTokenValue(singleToken[1], context, fieldPath)

    return renderTemplateString(input, context, fieldPath)
  }

  if (typeof input === 'number' || typeof input === 'boolean')
    return input

  if (Array.isArray(input)) {
    return input.map((item, index) => renderTemplateValue(item, context, `${fieldPath}[${index}]`))
  }

  if (typeof input === 'object') {
    const source = input as Record<string, unknown>
    const rendered: Record<string, unknown> = {}

    for (const [rawKey, rawValue] of Object.entries(source)) {
      const key = normalizeText(rawKey)
      if (!key)
        continue

      const value = renderTemplateValue(rawValue, context, `${fieldPath}.${key}`)
      if (value !== undefined)
        rendered[key] = value
    }

    return rendered
  }

  throw createServiceError(
    `模板字段不支持当前值类型：${fieldPath}`,
    'DICT_KEEPER_EXTERNAL_CRUD_TEMPLATE_VALUE_INVALID',
    {
      fieldPath,
      valueType: typeof input,
    },
  )
}

function renderTemplateString(
  template: string,
  context: Record<string, unknown>,
  fieldPath: string,
) {
  const normalizedTemplate = String(template)
  return normalizedTemplate.replace(TEMPLATE_TOKEN_RE, (_, tokenPath: string) => {
    const value = resolveTemplateTokenValue(tokenPath, context, fieldPath)
    return stringifyScalar(value)
  })
}

function resolveTemplateTokenValue(
  tokenPath: string,
  context: Record<string, unknown>,
  fieldPath: string,
) {
  const normalizedTokenPath = normalizeText(tokenPath)
  const value = getValueByPath(context, normalizedTokenPath)

  if (value === undefined) {
    throw createServiceError(
      `模板变量未找到：${normalizedTokenPath}`,
      'DICT_KEEPER_EXTERNAL_CRUD_TEMPLATE_TOKEN_NOT_FOUND',
      {
        fieldPath,
        tokenPath: normalizedTokenPath,
      },
    )
  }

  return value
}

function evaluateBusinessRule(responseData: unknown, rule: DictKeeperExternalCrudBusinessRule | undefined) {
  if (!rule) {
    return {
      enabled: false,
      matched: true,
      fieldPath: undefined,
      expectedValue: undefined,
      actualValue: undefined,
    }
  }

  const fieldPath = normalizeText(rule.fieldPath)
  if (!fieldPath) {
    throw createServiceError(
      '业务响应字段路径不能为空。',
      'DICT_KEEPER_EXTERNAL_CRUD_SUCCESS_FIELD_REQUIRED',
    )
  }

  const actualValue = getValueByPath(responseData, fieldPath)
  const matched = Object.is(actualValue, rule.expectedValue)

  return {
    enabled: true,
    matched,
    fieldPath,
    expectedValue: rule.expectedValue,
    actualValue,
  }
}

async function requestWithTimeout(
  url: string,
  options: {
    method: DictKeeperRequestMethod
    headers: Headers
    body?: string
  },
  timeoutMs: number,
) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      method: options.method,
      headers: options.headers,
      body: options.body,
      signal: controller.signal,
    })
  }
  catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw createServiceError(
        `外部接口请求超时（${timeoutMs}ms）`,
        'DICT_KEEPER_EXTERNAL_CRUD_TIMEOUT',
        { url },
      )
    }

    throw createServiceError(
      '外部接口请求异常',
      'DICT_KEEPER_EXTERNAL_CRUD_REQUEST_FAILED',
      {
        url,
        message: toErrorMessage(error),
      },
    )
  }
  finally {
    clearTimeout(timer)
  }
}

function normalizeAuthData(input: unknown) {
  if (input === undefined || input === null)
    return {}

  if (!isPlainRecord(input)) {
    throw createServiceError(
      '鉴权数据 authData 必须是对象。',
      'DICT_KEEPER_EXTERNAL_CRUD_AUTH_DATA_INVALID',
    )
  }

  return input
}

function normalizeContextData(input: unknown) {
  if (input === undefined || input === null)
    return {}

  if (!isPlainRecord(input)) {
    throw createServiceError(
      '模板上下文 contextData 必须是对象。',
      'DICT_KEEPER_EXTERNAL_CRUD_CONTEXT_DATA_INVALID',
    )
  }

  return input
}

function mergePayloadWithAuthData(
  payload: unknown,
  authData: Record<string, unknown>,
  mergeStrategy: DictKeeperEndpointMergeStrategy,
) {
  if (payload === undefined || payload === null)
    return { ...authData }

  if (!isPlainRecord(payload)) {
    throw createServiceError(
      '注入目标为 data 时，payload 必须是对象。',
      'DICT_KEEPER_EXTERNAL_CRUD_PAYLOAD_OBJECT_REQUIRED',
    )
  }

  if (mergeStrategy === 'payload-overrides') {
    return {
      ...authData,
      ...payload,
    }
  }

  return {
    ...payload,
    ...authData,
  }
}

function appendRecordToHeaders(headers: Headers, source: Record<string, unknown>) {
  for (const [rawKey, rawValue] of Object.entries(source)) {
    const key = rawKey.trim()
    if (!key)
      continue

    headers.set(key, stringifyScalar(rawValue))
  }
}

function appendRecordToSearchParams(params: URLSearchParams, source: Record<string, unknown>) {
  for (const [rawKey, rawValue] of Object.entries(source)) {
    const key = rawKey.trim()
    if (!key)
      continue

    params.set(key, stringifyScalar(rawValue))
  }
}

function buildRequestBody(payload: unknown, contentType: string | undefined) {
  if (payload === undefined)
    return undefined

  const normalizedContentType = normalizeText(contentType).toLowerCase()

  if (normalizedContentType.includes('application/x-www-form-urlencoded')) {
    if (!isPlainRecord(payload)) {
      throw createServiceError(
        'x-www-form-urlencoded 请求体仅支持对象类型 payload。',
        'DICT_KEEPER_EXTERNAL_CRUD_PAYLOAD_TYPE_INVALID',
      )
    }

    const params = new URLSearchParams()
    appendRecordToSearchParams(params, payload)
    return params.toString()
  }

  if (normalizedContentType.includes('text/plain'))
    return typeof payload === 'string' ? payload : stringifyScalar(payload)

  return JSON.stringify(payload)
}

function buildRequestUrl(basePath: string, endpointPath: string) {
  if (ABSOLUTE_URL_RE.test(endpointPath))
    return endpointPath

  const normalizedBasePath = normalizeText(basePath)
  if (!normalizedBasePath) {
    throw createServiceError(
      '外部 CRUD Base Path 不能为空。',
      'DICT_KEEPER_EXTERNAL_CRUD_BASE_PATH_REQUIRED',
    )
  }

  const trimmedBasePath = normalizedBasePath.replace(/\/+$/g, '')
  const normalizedEndpoint = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`

  return `${trimmedBasePath}${normalizedEndpoint}`
}

function appendQuery(url: string, query: URLSearchParams) {
  const queryString = query.toString()
  if (!queryString)
    return url

  return `${url}${url.includes('?') ? '&' : '?'}${queryString}`
}

function ensureCrudSection(input: unknown): DictKeeperCrudSection {
  if (typeof input === 'string' && CRUD_SECTIONS.includes(input as DictKeeperCrudSection))
    return input as DictKeeperCrudSection

  throw createServiceError(
    'section 仅支持 dictionary 或 item。',
    'DICT_KEEPER_EXTERNAL_CRUD_SECTION_INVALID',
  )
}

function ensureCrudAction(input: unknown): DictKeeperCrudAction {
  if (typeof input === 'string' && CRUD_ACTIONS.includes(input as DictKeeperCrudAction))
    return input as DictKeeperCrudAction

  throw createServiceError(
    'action 仅支持 create/read/update/delete。',
    'DICT_KEEPER_EXTERNAL_CRUD_ACTION_INVALID',
  )
}

function ensureInjectTarget(input: unknown): DictKeeperAuthInjectTarget {
  if (typeof input === 'string' && INJECT_TARGETS.includes(input as DictKeeperAuthInjectTarget))
    return input as DictKeeperAuthInjectTarget

  return 'header'
}

function ensureMergeStrategy(input: unknown): DictKeeperEndpointMergeStrategy {
  if (typeof input === 'string') {
    const normalized = normalizeText(input)
    if (normalized === 'payload-overrides')
      return 'payload-overrides'
  }

  return DEFAULT_MERGE_STRATEGY
}

function normalizeOptionalTimeout(input: unknown) {
  if (input === undefined || input === null)
    return undefined

  if (typeof input !== 'number' || !Number.isFinite(input))
    return undefined

  const normalized = Math.trunc(input)
  if (normalized <= 0)
    return undefined

  return Math.min(normalized, MAX_TIMEOUT_MS)
}

function normalizeTimeout(input: unknown) {
  if (typeof input !== 'number' || !Number.isFinite(input))
    return DEFAULT_TIMEOUT_MS

  const normalized = Math.trunc(input)
  if (normalized <= 0)
    return DEFAULT_TIMEOUT_MS

  return Math.min(normalized, MAX_TIMEOUT_MS)
}

function getValueByPath(target: unknown, fieldPath: string): unknown {
  const segments = fieldPath
    .split('.')
    .map(item => item.trim())
    .filter(Boolean)

  if (segments.length === 0)
    return undefined

  let current: unknown = target
  for (const segment of segments) {
    if (!current || typeof current !== 'object')
      return undefined

    current = (current as Record<string, unknown>)[segment]
  }

  return current
}

function tryParseJson(text: string): unknown {
  const normalized = normalizeText(text)
  if (!normalized)
    return undefined

  try {
    return JSON.parse(normalized)
  }
  catch {
    return undefined
  }
}

function stringifyScalar(input: unknown) {
  if (input === null)
    return 'null'

  if (typeof input === 'string')
    return input

  if (typeof input === 'number' || typeof input === 'boolean' || typeof input === 'bigint')
    return String(input)

  return JSON.stringify(input)
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

function createServiceError(message: string, code: string, details?: unknown) {
  return Object.assign(new Error(message), {
    code,
    details,
  })
}

export default {
  executeDictKeeperExternalCrud,
}
