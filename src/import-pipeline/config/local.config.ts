import type { RequestMethod, RequestMode } from '../types'

export const DEFAULT_METHOD: RequestMethod = 'POST'
export const DEFAULT_BATCH_SIZE = 10
export const DEFAULT_REQUEST_MODE: RequestMode = 'raw-item'
export const DEFAULT_WRAPPER_KEY = 'data'

export const DEFAULT_HEADERS_TEXT = '{\n  "Content-Type": "application/json"\n}'
export const DEFAULT_FIXED_PARAMS_TEXT = '{\n  "tenant": "default",\n  "createdBy": "flow-dock"\n}'
export const DEFAULT_DYNAMIC_PARAMS_TEXT = '{\n  "externalCode": "{{code}}",\n  "displayName": "{{name}}",\n  "sourceIndex": "{{index}}"\n}'
export const DEFAULT_INPUT_TEXT = '[\n  { "name": "Alpha", "code": "A-001" },\n  { "name": "Beta", "code": "B-002" }\n]'
export const READY_MESSAGE = '准备就绪：请配置接口并粘贴 JSON。'

export const AUTO_EXTRACT_CANDIDATES = ['items', 'list', 'data', 'rows', 'records'] as const

export const FORBIDDEN_REQUEST_HEADER_NAMES = new Set([
  'accept-charset',
  'accept-encoding',
  'access-control-request-headers',
  'access-control-request-method',
  'connection',
  'content-length',
  'cookie',
  'cookie2',
  'date',
  'dnt',
  'expect',
  'host',
  'keep-alive',
  'origin',
  'permissions-policy',
  'proxy-',
  'referer',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'user-agent',
  'via',
  'sec-',
])

export const FORBIDDEN_REQUEST_HEADER_PREFIXES = ['proxy-', 'sec-']
