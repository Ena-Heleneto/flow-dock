import type { Tabs } from 'webextension-polyfill'

/**
 * 解析URL并返回路径名，如果URL无效则返回默认路径
 * @param url - 需要解析的URL字符串
 * @returns 解析后的路径名，如果URL无效或路径为空则返回 '/'
 */
export function fallbackRoute(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.pathname || '/'
  }
  catch {
    return '/'
  }
}

/**
 * 为给定的URL生成备用路由签名
 * @param url - 要解析的URL字符串
 * @param route - 备用路由路径
 * @returns 如果URL有效，返回origin与route的组合；否则返回route本身
 */
export function fallbackRouteSig(url: string, route: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.origin}${route}`
  }
  catch {
    return route
  }
}

/**
 * 从URL中提取主机名，作为系统标识的后备方案
 * @param url - 要解析的URL字符串
 * @returns 返回URL的主机名，如果解析失败或主机名为空则返回 'unknown-system'
 * @example
 * fallbackSystem('https://example.com/path') // => 'example.com'
 * fallbackSystem('invalid-url') // => 'unknown-system'
 */
export function fallbackSystem(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.hostname || 'unknown-system'
  }
  catch {
    return 'unknown-system'
  }
}

/**
 * 根据路由路径获取备用模块名称
 * @param route - 路由路径字符串，例如 "/dashboard/settings"
 * @returns 返回路由的第一个段落作为模块名称，如果路由为空则返回 'root'
 * @example
 * fallbackModule('/dashboard/settings') // 返回 'dashboard'
 * fallbackModule('/') // 返回 'root'
 * fallbackModule('') // 返回 'root'
 */
export function fallbackModule(route: string): string {
  const segments = route.split('/').filter(Boolean)
  return segments[0] ?? 'root'
}

/**
 * 获取当前活动的浏览器标签页
 * @returns {Promise<Tabs.Tab | undefined>} 返回当前活动标签页对象的 Promise
 * @throws {Error} 当查询标签页失败时可能抛出错误
 */
export async function getCurrentTab(): Promise<Tabs.Tab | undefined> {
  const tabs = await browser.tabs.query({ active: true, lastFocusedWindow: true })
  return tabs[0]
}

interface NormalizedPageMetrics {
  viewportWidth: number
  viewportHeight: number
  pageHeight: number
  pageWidth: number
  scrollY: number
  devicePixelRatio: number
}

/**
 * 规范化页面指标数据
 *
 * 将页面指标中的各个数值转换为有效的范围内的值。所有尺寸相关的指标
 * 都会向下取整并确保不小于1，滚动位置确保不小于0，设备像素比确保不小于1。
 *
 * @param metrics - 原始的页面指标数据对象
 * @returns 规范化后的页面指标对象，其中所有数值都已调整到有效范围内
 */
export function normalizeMetrics(metrics: NormalizedPageMetrics): NormalizedPageMetrics {
  return {
    viewportWidth: Math.max(1, Math.floor(metrics.viewportWidth)),
    viewportHeight: Math.max(1, Math.floor(metrics.viewportHeight)),
    pageHeight: Math.max(1, Math.floor(metrics.pageHeight)),
    pageWidth: Math.max(1, Math.floor(metrics.pageWidth)),
    scrollY: Math.max(0, Math.floor(metrics.scrollY)),
    devicePixelRatio: Math.max(1, metrics.devicePixelRatio || 1),
  }
}
