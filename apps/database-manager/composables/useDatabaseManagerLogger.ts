import type { LogEntryLevel } from '~/shared/composables/useLogger'
import { useLogger } from '~/shared/composables/useLogger'

interface ResponsePayload {
  ok?: boolean
}

export interface DatabaseManagerLogger {
  appendStartLog: (action: string, payload?: unknown) => void
  appendSuccessLog: (action: string, payload?: unknown) => void
  appendErrorLog: (action: string, error: unknown) => void
  formatItemData: (data: unknown) => string
}

function stringifyLogPayload(payload: unknown) {
  if (typeof payload === 'string')
    return payload

  try {
    return JSON.stringify(payload, null, 2)
  }
  catch {
    return String(payload)
  }
}

function resolveLogLevel(payload: unknown): LogEntryLevel {
  if (typeof payload === 'object' && payload && 'ok' in payload) {
    const responsePayload = payload as ResponsePayload
    return responsePayload.ok === false ? 'WARN' : 'INFO'
  }

  return 'INFO'
}

function createPhaseMessage(action: string, phase: 'start' | 'success' | 'error', payload?: unknown) {
  if (payload === undefined)
    return `[${action}] ${phase}`

  return `[${action}] ${phase}\n${stringifyLogPayload(payload)}`
}

export function useDatabaseManagerLogger(): DatabaseManagerLogger {
  const { insertOneLog } = useLogger()

  function appendStartLog(action: string, payload?: unknown) {
    insertOneLog({
      level: 'INFO',
      message: createPhaseMessage(action, 'start', payload),
    })
  }

  function appendSuccessLog(action: string, payload?: unknown) {
    insertOneLog({
      level: resolveLogLevel(payload),
      message: createPhaseMessage(action, 'success', payload),
    })
  }

  function appendErrorLog(action: string, error: unknown) {
    const message = error instanceof Error
      ? `${error.message}\n${error.stack ?? ''}`
      : stringifyLogPayload(error)

    insertOneLog({
      level: 'ERROR',
      message: createPhaseMessage(action, 'error', message),
    })
  }

  function formatItemData(data: unknown) {
    return stringifyLogPayload(data)
  }

  return {
    appendStartLog,
    appendSuccessLog,
    appendErrorLog,
    formatItemData,
  }
}
