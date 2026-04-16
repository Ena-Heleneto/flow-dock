import type { PreviewRow } from '~/types/database-views.type'

/**
 * 将任意类型的键值转换为字符串表示
 * @param key - 要转换的键值，可以是任意类型
 * @returns 转换后的字符串
 */
export function keyToString(key: unknown): string {
  if (typeof key === 'string' || typeof key === 'number' || typeof key === 'bigint')
    return String(key)

  if (key instanceof Date)
    return key.toISOString()

  return JSON.stringify(key)
}

/**
 * 规范化预览行数据
 *
 * 将远程返回的未知类型数组转换为标准的预览行对象数组。
 * 对于每一项，如果包含 `key` 和 `value` 属性则直接使用，
 * 否则将 `id` 属性（或索引）作为 key，原项作为 value。
 *
 * @param remoteRows - 来自远程的原始数据数组，类型未知
 * @returns 规范化后的预览行对象数组
 */
export function normalizePreviewRows(remoteRows: unknown[]): PreviewRow[] {
  return remoteRows.map((item, index): PreviewRow => {
    if (
      item
      && typeof item === 'object'
      && 'key' in item
      && 'value' in item
    ) {
      const preview = item as { key: unknown, value: unknown }
      return {
        key: preview.key,
        keyText: keyToString(preview.key),
        value: preview.value,
      }
    }

    const valueObject = item as { id?: IDBValidKey }
    return {
      key: valueObject?.id ?? index,
      keyText: keyToString(valueObject?.id ?? index),
      value: item,
    }
  })
}

/**
 * 解析编辑器中的 JSON 对象字符串
 * @param source - 待解析的 JSON 字符串
 * @returns 解析后的对象
 * @throws {Error} 当 JSON 字符串格式无效时抛出错误，错误信息为 'Row JSON is invalid'
 * @throws {Error} 当解析结果不是对象或为数组时抛出错误，错误信息为 'Row JSON must be an object'
 */
export function parseEditorJsonObject(source: string): Record<string, unknown> {
  let parsed: unknown

  try {
    parsed = JSON.parse(source)
  }
  catch {
    throw new Error('Row JSON is invalid')
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new Error('Row JSON must be an object')

  return parsed as Record<string, unknown>
}

/**
 * 创建编辑器模板
 * @returns {string} 返回一个空的JSON对象字符串作为编辑器的初始模板
 */
export function createEditorTemplate(): string {
  return '{}'
}
