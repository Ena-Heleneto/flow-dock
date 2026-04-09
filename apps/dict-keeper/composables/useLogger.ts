type LogLevel = 'ALL' | 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'

interface LogInput { level: LogLevel, message: string }

interface LogEntry extends LogInput { timestamp: Date }

interface UseLoggerState {
  LEVEL_LIST: Ref<LogLevel[]>
  insertOneLog: (log: LogInput) => void
  insertManyLogs: (logs: LogInput[]) => void
  clearLog: () => void
  currentLog: ComputedRef<LogEntry[]>
}

export const USE_LOGGER_KEY: InjectionKey<UseLoggerState> = Symbol('USE_LOGGER')

export function useLogger(level: Ref<LogLevel> = ref<LogLevel>('ALL')): UseLoggerState {
  const LEVEL_LIST = ref<LogLevel[]>(['ALL', 'INFO', 'WARN', 'ERROR', 'DEBUG'])
  const logList = ref<LogEntry[]>([])

  function insertOneLog({ level, message }: LogInput) {
    const timestamp = new Date()
    logList.value.push({ level, message, timestamp })
  }

  function insertManyLogs(logs: LogInput[]) {
    logs.forEach(log => insertOneLog(log))
  }

  function clearLog() {
    logList.value = []
  }

  const currentLog = computed<LogEntry[]>(() => {
    if (level.value === 'ALL')
      return logList.value

    return logList.value.filter(({ level: _level }: LogEntry) => _level === level.value)
  })

  const loggerState: UseLoggerState = { LEVEL_LIST, insertOneLog, insertManyLogs, clearLog, currentLog }
  provide(USE_LOGGER_KEY, loggerState)
  return loggerState
}
