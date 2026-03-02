export function readBody<T = unknown>(event: unknown): T {
  const value = event as unknown

  if (!value || typeof value !== 'object')
    return value as T

  if ('data' in value)
    return (value as { data: T }).data

  return value as T
}

/**
 * 定义一个事件处理器
 * @param handler - 事件处理函数
 * @returns 返回一个包含事件处理器标识和处理函数的已定义事件处理器对象
 */
export function defineEventHandler<TEvent = unknown, TResult = unknown>(
  handler: EventHandler<TEvent, TResult>,
): DefinedEventHandler<TEvent, TResult> {
  return {
    __flowDockEventHandler: true,
    handler,
  }
}

/**
 * 检查给定的值是否为已定义的事件处理器
 * @param value - 需要进行类型检查的tH值
 * @returns 如果值是 `DefinedEventHandler` 类型则返回 `true`，否则返回 `false`
 */
export function isDefinedEventHandler<TEvent = unknown, TResult = unknown>(
  value: unknown,
): value is DefinedEventHandler<TEvent, TResult> {
  if (!value || typeof value !== 'object')
    return false

  const candidate = value as Partial<DefinedEventHandler<TEvent, TResult>>
  return candidate.__flowDockEventHandler === true && typeof candidate.handler === 'function'
}
