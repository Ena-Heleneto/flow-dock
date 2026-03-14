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

export type JsonObject = Record<string, unknown>
