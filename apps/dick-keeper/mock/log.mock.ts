export type LogLevel = 'ALL' | 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'

export interface LogEntry {
  level: Exclude<LogLevel, 'ALL'>
  message: string
  timestamp: Date
}

const DEFAULT_COUNT = 100
const DEFAULT_SEED = 20260407
const DEFAULT_TIME_WINDOW_MS = 10 * 60 * 1000

const LOG_LEVEL_POOL: LogEntry['level'][] = ['INFO', 'WARN', 'ERROR', 'DEBUG']

const LOG_MESSAGES: Record<LogEntry['level'], string[]> = {
  INFO: [
    '字典索引加载完成',
    '词条增量同步成功',
    '本地缓存命中，跳过远程拉取',
    '解析批次已提交到入库队列',
    '词条去重处理完成',
    '基础配置刷新完成',
    '数据分片合并完成',
    '本轮任务执行结束',
  ],
  WARN: [
    '检测到重复词条，已自动忽略',
    '部分字段缺失，已使用默认值',
    '请求延迟升高，已降级为串行处理',
    '缓存有效期即将到期，请关注同步状态',
    '字典标签映射存在冲突，已保留旧值',
    '批量入库触发限流，已排队等待',
    '解析到未知词性，已标记为待确认',
    '输入数据包含空行，已自动清洗',
  ],
  ERROR: [
    '字典索引写入失败，正在重试',
    '词条校验失败：主键格式非法',
    '事务提交失败，已回滚本次操作',
    '远程同步中断：连接被重置',
    '解析器异常退出，请检查输入源',
    '批处理任务失败：分片校验未通过',
    '数据库打开失败：权限不足',
    '日志落盘失败：存储空间不足',
  ],
  DEBUG: [
    '调试模式开启：采样率=0.25',
    '命中快速路径，跳过完整校验',
    '词条标准化规则已注入',
    '当前批次游标推进到下一页',
    '生成哈希完成，准备比对旧版本',
    '分支策略切换为 merge-first',
    '正在输出详细追踪信息',
    '调试快照已写入内存队列',
  ],
}

export interface CreateMockLogsOptions {
  count?: number
  seed?: number
  timeWindowMs?: number
}

function createSeededRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (1664525 * state + 1013904223) >>> 0
    return state / 4294967296
  }
}

function pickRandom<T>(list: T[], random: () => number) {
  return list[Math.floor(random() * list.length)]
}

function createLogEntry(level: LogEntry['level'], index: number, now: number, random: () => number, timeWindowMs: number): LogEntry {
  const messageTemplate = pickRandom(LOG_MESSAGES[level], random)
  const message = `${messageTemplate} #${String(index + 1).padStart(3, '0')}`
  const offsetMs = Math.floor(random() * timeWindowMs)

  return {
    level,
    message,
    timestamp: new Date(now - offsetMs),
  }
}

export function createMockLogs(options: CreateMockLogsOptions = {}): LogEntry[] {
  const count = options.count ?? DEFAULT_COUNT
  const seed = options.seed ?? DEFAULT_SEED
  const timeWindowMs = options.timeWindowMs ?? DEFAULT_TIME_WINDOW_MS
  const random = createSeededRandom(seed)
  const now = Date.now()
  const logs: LogEntry[] = []

  for (let i = 0; i < count; i++) {
    const level = i < LOG_LEVEL_POOL.length
      ? LOG_LEVEL_POOL[i]
      : pickRandom(LOG_LEVEL_POOL, random)

    logs.push(createLogEntry(level, i, now, random, timeWindowMs))
  }

  return logs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
}

export const MOCK_LOG_LIST = createMockLogs()
