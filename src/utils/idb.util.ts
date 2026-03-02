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
