import consola from 'consola'

type LogArgs = [unknown, ...unknown[]]
type AsyncFn = (...args: any[]) => Promise<any>
type AsyncApi = Record<string, AsyncFn>

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function formatTimestamp(date = new Date()): string {
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  const seconds = pad(date.getSeconds())
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

function withTimestamp(...args: unknown[]): LogArgs {
  return [`[${formatTimestamp()}]`, ...args]
}

export function createLogger(tag?: string) {
  const baseLogger = tag ? consola.withTag(tag) : consola

  return {
    log: (...args: unknown[]) => baseLogger.log(...withTimestamp(...args)),
    info: (...args: unknown[]) => baseLogger.info(...withTimestamp(...args)),
    success: (...args: unknown[]) => baseLogger.success(...withTimestamp(...args)),
    warn: (...args: unknown[]) => baseLogger.warn(...withTimestamp(...args)),
    error: (...args: unknown[]) => baseLogger.error(...withTimestamp(...args)),
    debug: (...args: unknown[]) => baseLogger.debug(...withTimestamp(...args)),
  }
}

export function wrapAsyncApiWithLogger<T extends AsyncApi>(
  logger: ReturnType<typeof createLogger>,
  api: T,
): T {
  return Object.fromEntries(
    Object.entries(api).map(([name, fn]) => {
      const wrapped = (async (...args: Parameters<typeof fn>) => {
        logger.debug(`${name} start`, { args })
        try {
          const result = await fn(...args)
          logger.debug(`${name} done`)
          return result
        }
        catch (error) {
          logger.error(`${name} failed`, error)
          throw error
        }
      }) as typeof fn

      return [name, wrapped]
    }),
  ) as T
}

const logger = createLogger('FlowDock')

export default logger
export { logger }
