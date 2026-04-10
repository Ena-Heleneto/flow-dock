export type LogLevel = 'ALL' | 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'
export type LogEntryLevel = Exclude<LogLevel, 'ALL'>

export interface LogInput {
  level: LogEntryLevel
  message: string
}

export interface LogEntry extends LogInput {
  timestamp: Date
}

export interface LogStats {
  INFO: number
  WARN: number
  ERROR: number
  DEBUG: number
}

export interface UseLoggerState {
  LEVEL_LIST: Ref<LogLevel[]>
  currentLevel: Ref<LogLevel>
  logList: Ref<LogEntry[]>
  currentLog: ComputedRef<LogEntry[]>
  totalCount: ComputedRef<number>
  levelStats: ComputedRef<LogStats>
  setLevel: (level: LogLevel) => void
  insertOneLog: (log: LogInput) => void
  insertManyLogs: (logs: LogInput[]) => void
  clearLog: () => void
}

export const USE_LOGGER_KEY: InjectionKey<UseLoggerState> = Symbol('USE_LOGGER')

export function useLogger(level: Ref<LogLevel> = ref<LogLevel>('ALL')): UseLoggerState {
  const LEVEL_LIST = ref<LogLevel[]>(['ALL', 'INFO', 'WARN', 'ERROR', 'DEBUG'])
  const currentLevel = level
  const logList = ref<LogEntry[]>([])

  function setLevel(nextLevel: LogLevel) {
    currentLevel.value = nextLevel
  }

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
    if (currentLevel.value === 'ALL')
      return logList.value

    return logList.value.filter(({ level: _level }: LogEntry) => _level === currentLevel.value)
  })

  const totalCount = computed(() => logList.value.length)

  const levelStats = computed<LogStats>(() => {
    return logList.value.reduce<LogStats>((stats, log) => {
      stats[log.level] += 1
      return stats
    }, {
      INFO: 0,
      WARN: 0,
      ERROR: 0,
      DEBUG: 0,
    })
  })

  const loggerState: UseLoggerState = {
    LEVEL_LIST,
    currentLevel,
    logList,
    currentLog,
    totalCount,
    levelStats,
    setLevel,
    insertOneLog,
    insertManyLogs,
    clearLog,
  }

  provide(USE_LOGGER_KEY, loggerState)
  return loggerState
}
