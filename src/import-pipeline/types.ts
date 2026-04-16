export type RunStatus = 'idle' | 'running' | 'success' | 'error' | 'stopped'
export type RequestMode = 'raw-item' | 'wrapped-item'
export type RequestMethod = 'POST' | 'PUT'

export interface BatchResult {
  total: number
  success: number
  failed: number
}

export interface ParsedHeadersResult {
  headers: Headers
  blockedHeaderNames: string[]
}

export interface CookieDiagnostic {
  toneClass: string
  title: string
  messages: string[]
}

export interface SavedImportPipelineConfig {
  id: string
  name: string
  createdAt: number
  endpoint: string
  method: RequestMethod
  batchSize: number
  requestMode: RequestMode
  wrapperKey: string
  autoExtractObjectField: boolean
  headersText: string
  fixedParamsText: string
  dynamicParamsText: string
  inputText: string
  updatedAt: number
}

export interface SavedImportPipelineConfigItem {
  id: string
  name: string
  updatedAt: number
}

export type JsonObject = Record<string, unknown>
