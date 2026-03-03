import type { SchemaTransactionContext } from '~/types/define-schema-handler.type'
import type { IdbBaseRecord, IdbLinkedFindByCriteriaResult, IdbLinkedFindByCriteriaStep } from '~/types/idb.type'

/**
 * 生成一个唯一的页面ID
 *
 * 优先使用浏览器原生的 `crypto.randomUUID()` 方法生成符合 RFC 4122 标准的 UUID v4。
 * 如果运行环境不支持该方法,则使用时间戳和随机数组合作为备选方案。
 *
 * @returns {PageId} 生成的唯一页面标识符
 */
export function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    return crypto.randomUUID()

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * 检查页面记录是否处于活跃状态
 * @param record - 页面记录对象
 * @returns 如果记录未被删除则返回 true，否则返回 false
 */
export function isActiveRecord<T extends IdbBaseRecord>(record: T): boolean {
  return typeof record.deletedAt !== 'number'
}

/**
 * 筛选活跃的记录
 * @param records - 需要筛选的记录数组
 * @returns 返回包含所有活跃记录的数组
 */
export function filterActiveRecords<T extends IdbBaseRecord>(records: T[]): T[] {
  return records.filter(record => isActiveRecord(record))
}

/**
 * 将值转换为 IndexedDB 查询所用的有效键值或键范围
 * @param value - 要转换的值，可以是任何类型
 * @returns 转换后的 IDBValidKey、IDBKeyRange 或 null
 * @remarks
 * 支持以下类型的转换：
 * - `undefined` 或 `null` 返回 `null`
 * - `Date` 对象直接返回
 * - `string` 或 `number` 类型直接返回
 * - `Array` 类型作为 IDBValidKey 返回
 * - `IDBKeyRange` 实例直接返回
 * - 其他类型返回 `null`
 */
function toLinkedQueryValue(value: unknown): IDBValidKey | IDBKeyRange | null {
  if (value === undefined || value === null)
    return null

  if (value instanceof Date)
    return value

  if (typeof value === 'string' || typeof value === 'number')
    return value

  if (Array.isArray(value))
    return value as IDBValidKey

  if (typeof IDBKeyRange !== 'undefined' && value instanceof IDBKeyRange)
    return value

  return null
}

/**
 * 通过链式条件查找多个记录
 * @param transaction - 数据库事务上下文
 * @param steps - 链式查找步骤数组，每个步骤定义了查询条件和使用的数据库模式
 * @returns 返回包含查询结果记录数组的对象，数组中每个元素是查询到的记录或 null
 * @description
 * 该函数按顺序执行多个查找步骤。每个步骤可以：
 * - 使用固定的查询条件（step.query）
 * - 或从前一个步骤的结果中提取查询条件（step.queryFrom）
 *
 * 如果某个步骤的查询条件为空或不是有效对象，则该步骤返回 null。
 *
 */
export async function linkedFindByCriteria(
  transaction: SchemaTransactionContext,
  steps: IdbLinkedFindByCriteriaStep[],
): Promise<IdbLinkedFindByCriteriaResult> {
  if (!steps.length)
    return { records: [] }

  const records: Array<Record<string, unknown> | null> = []

  for (const [index, step] of steps.entries()) {
    const previousRecord = records[index - 1]
    const rawQuery = step.query ?? (step.queryFrom ? previousRecord?.[step.queryFrom] : undefined)
    const query = toLinkedQueryValue(rawQuery)

    if (!query) {
      records.push(null)
      continue
    }

    const [record] = await step.schema.findByCriteria<Record<string, unknown>>(transaction, {
      indexName: step.indexName,
      query,
      count: step.count ?? 1,
    })

    records.push(typeof record === 'object' && record !== null && !Array.isArray(record) ? record : null)
  }

  return { records }
}
