/**
 * 捕获当前活跃标签页的可见内容
 * @param windowId - 可选，指定要捕获的窗口ID。如果未指定，则捕获当前活跃窗口
 * @returns 返回包含捕获图像信息的对象
 * @returns {string} mime - 图像的MIME类型
 * @returns {Blob} blob - 图像的二进制数据
 * @returns {number} width - 图像的宽度（像素）
 * @returns {number} height - 图像的高度（像素）
 */
export async function captureVisibleTab(windowId?: number) {
  const dataUrl = await browser.tabs.captureVisibleTab(windowId, { format: 'png' })
  const mime = parseMimeFromDataUrl(dataUrl)
  const blob = await dataUrlToBlob(dataUrl)
  const { width, height } = await resolveImageSize(blob)

  return { mime, blob, width, height }
}

/**
 * 延迟执行指定的毫秒数
 * @param ms - 延迟时间，单位为毫秒
 * @returns 返回一个 Promise，在指定时间后 resolve
 */
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 获取页面的度量信息
 *
 * 通过在指定标签页中执行脚本，获取页面的滚动尺寸、视口尺寸、滚动位置和设备像素比等信息。
 *
 * @param tabId - 浏览器标签页的ID
 * @returns 返回包含页面度量信息的对象，如果执行失败则返回null。对象包含以下属性：
 *   - scrollX: 页面水平滚动距离
 *   - scrollY: 页面垂直滚动距离
 *   - viewportWidth: 视口宽度
 *   - viewportHeight: 视口高度
 *   - scrollWidth: 页面实际滚动宽度（与视口宽度的较大值）
 *   - scrollHeight: 页面实际滚动高度（与视口高度的较大值）
 *   - devicePixelRatio: 设备像素比
 *
 */
async function getPageMetrics(tabId: number) {
  const [injectionResult] = await browser.scripting.executeScript({
    target: { tabId },
    func: () => {
      const body = document.body
      const root = document.documentElement
      const scrollWidth = Math.max(
        window.innerWidth,
        root?.scrollWidth ?? 0,
        body?.scrollWidth ?? 0,
      )
      const scrollHeight = Math.max(
        window.innerHeight,
        root?.scrollHeight ?? 0,
        body?.scrollHeight ?? 0,
      )

      return {
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        scrollWidth,
        scrollHeight,
        devicePixelRatio: window.devicePixelRatio || 1,
      }
    },
  })

  return (injectionResult?.result ?? null) as PageMetrics | null
}

/**
 * 将页面滚动到指定的垂直位置
 * @param tabId - 浏览器标签页的ID
 * @param y - 目标垂直滚动位置(像素)
 * @returns 返回滚动后页面的实际垂直位置，如果执行失败则返回0
 */
async function scrollPageTo(tabId: number, y: number) {
  const [injectionResult] = await browser.scripting.executeScript({
    target: { tabId },
    args: [y],
    func: (nextY: number) => {
      window.scrollTo(0, nextY)
      return window.scrollY
    },
  })

  return Number(injectionResult?.result ?? 0)
}

/**
 * 恢复页面滚动位置
 *
 * 在指定的浏览器标签页中将页面滚动到指定的坐标位置。
 * 通过内容脚本在目标标签页中执行滚动操作。
 *
 * @param tabId - 浏览器标签页的ID
 * @param x - 水平滚动位置（像素）
 * @param y - 垂直滚动位置（像素）
 * @returns 返回一个Promise，当脚本执行完成时解决
 *
 */
async function restorePageScroll(tabId: number, x: number, y: number) {
  await browser.scripting.executeScript({
    target: { tabId },
    args: [x, y],
    func: (nextX: number, nextY: number) => {
      window.scrollTo(nextX, nextY)
    },
  })
}

async function stitchCapturedSlices(slices: CapturedSlice[], metrics: PageMetrics) {
  if (!slices.length)
    throw new Error('No slices captured')

  if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap !== 'function')
    return slices[0].capture

  const firstSlice = slices[0].capture
  const dpr = firstSlice.width > 0 && metrics.viewportWidth > 0
    ? firstSlice.width / metrics.viewportWidth
    : metrics.devicePixelRatio || 1

  const canvasWidth = Math.max(1, firstSlice.width)
  const canvasHeight = Math.max(1, Math.ceil(metrics.scrollHeight * dpr))
  const canvas = new OffscreenCanvas(canvasWidth, canvasHeight)
  const context = canvas.getContext('2d')
  if (!context)
    return firstSlice

  for (const slice of slices) {
    const bitmap = await createImageBitmap(slice.capture.blob)
    try {
      const drawY = Math.max(0, Math.round(slice.scrollY * dpr))
      context.drawImage(bitmap, 0, drawY)
    }
    finally {
      bitmap.close()
    }
  }

  const blob = await canvas.convertToBlob({ type: 'image/png' })
  return {
    mime: blob.type || 'image/png',
    blob,
    width: canvas.width,
    height: canvas.height,
  }
}

export async function captureFullPageTab(tabId?: number, windowId?: number) {
  if (typeof tabId !== 'number')
    return await captureVisibleTab(windowId)

  const metrics = await getPageMetrics(tabId)
  if (!metrics)
    return await captureVisibleTab(windowId)

  if (metrics.scrollHeight <= metrics.viewportHeight + 1)
    return await captureVisibleTab(windowId)

  const slices: CapturedSlice[] = []
  const visitedScrollY = new Set<number>()
  const originalX = metrics.scrollX
  const originalY = metrics.scrollY

  try {
    let targetY = 0
    while (targetY < metrics.scrollHeight) {
      const actualScrollY = await scrollPageTo(tabId, targetY)
      if (visitedScrollY.has(actualScrollY))
        break

      visitedScrollY.add(actualScrollY)
      await sleep(120)

      const capture = await captureVisibleTab(windowId)
      slices.push({ scrollY: actualScrollY, capture })

      if (actualScrollY + metrics.viewportHeight >= metrics.scrollHeight - 1)
        break

      targetY = actualScrollY + metrics.viewportHeight
    }
  }
  finally {
    await restorePageScroll(tabId, originalX, originalY)
  }

  if (!slices.length)
    return await captureVisibleTab(windowId)

  return await stitchCapturedSlices(slices, metrics)
}

/**
 * 从数据URL中解析MIME类型
 * @param dataUrl - 数据URL字符串，格式为 `data:mime/type;base64,...` 或 `data:mime/type,...`
 * @returns 解析出的MIME类型字符串，如果无法解析则默认返回 `image/png`
 */
export function parseMimeFromDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+)[;,]/i)
  return match?.[1] ?? 'image/png'
}

/**
 * 将数据URL转换为Blob对象
 * @param dataUrl - 数据URL字符串，通常来自canvas.toDataURL()或其他生成的数据URL
 * @returns 返回一个Promise，解析为对应的Blob对象
 */
export async function dataUrlToBlob(dataUrl: string) {
  const response = await fetch(dataUrl)
  return await response.blob()
}

/**
 * 将 Blob 转换为 data URL
 * @param blob - 需要转换的 Blob 对象
 * @returns data URL 字符串
 */
export function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('Failed to convert blob to data URL'))
    reader.readAsDataURL(blob)
  })
}

/**
 * 解析图片 Blob 的尺寸信息
 * @param blob - 图片的 Blob 对象
 * @returns 包含图片宽度和高度的对象。如果无法解析或出错，则返回宽高均为 0 的对象
 */
export async function resolveImageSize(blob: Blob) {
  if (typeof createImageBitmap !== 'function')
    return { width: 0, height: 0 }

  try {
    const bitmap = await createImageBitmap(blob)
    const size = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return size
  }
  catch {
    return { width: 0, height: 0 }
  }
}

/**
 * 根据 MIME 类型返回对应的文件扩展名
 * @param mime - MIME 类型字符串，例如 'image/jpeg'、'image/webp' 等
 * @returns 文件扩展名，支持 'jpg'、'webp' 或默认 'png'
 */
export function extensionByMime(mime: string) {
  if (mime.includes('jpeg'))
    return 'jpg'
  if (mime.includes('webp'))
    return 'webp'
  return 'png'
}

/**
 * 构建本地文件路径
 * @param relativePath - 相对路径，如果为空则返回 undefined
 * @param screenshotId - 截图的唯一标识符
 * @param mime - 文件的 MIME 类型，用于确定文件扩展名
 * @returns 返回格式化的本地文件路径字符串，如果 relativePath 为空则返回 undefined
 */
export function buildLocalPath(relativePath: string | undefined, screenshotId: string, mime: string) {
  if (!relativePath)
    return undefined

  const normalizedBase = relativePath.endsWith('/') ? relativePath.slice(0, -1) : relativePath
  const ext = extensionByMime(mime)
  if (!normalizedBase)
    return `/${screenshotId}.${ext}`
  return `${normalizedBase}/${screenshotId}.${ext}`
}

/**
 * 规范化下载基础路径
 *
 * 将路径中的反斜杠转换为正斜杠，并移除路径开头和结尾的斜杠
 *
 * @param basePath - 需要规范化的基础路径
 * @returns 规范化后的路径字符串
 */
export function normalizeDownloadBasePath(basePath: string) {
  return basePath
    .replace(/\\+/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
}

/**
 * 下载截图文件到本地
 * @param blob - 截图的二进制数据
 * @param mime - 图片的MIME类型（如 'image/jpeg', 'image/webp', 'image/png'）
 * @param screenshotId - 截图的唯一标识符
 * @param basePath - 下载文件的基础路径
 * @returns 返回下载任务的ID，如果基础路径无效则返回 undefined
 * @remarks
 * 该函数会根据MIME类型自动确定文件扩展名：
 * - 'jpeg' -> 'jpg'
 * - 'webp' -> 'webp'
 * - 其他 -> 'png'
 *
 * 下载过程中如果目标文件已存在，会自动添加数字后缀以避免覆盖
 */
export async function downloadScreenshot(blob: Blob, mime: string, screenshotId: string, basePath: string) {
  const normalizedBasePath = normalizeDownloadBasePath(basePath)
  if (!normalizedBasePath)
    return undefined

  const extension = mime.includes('jpeg') ? 'jpg' : mime.includes('webp') ? 'webp' : 'png'
  const filename = `${normalizedBasePath}/${screenshotId}.${extension}`
  let blobUrl: string | undefined
  const downloadUrl = (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function')
    ? (() => {
        blobUrl = URL.createObjectURL(blob)
        return blobUrl
      })()
    : await blobToDataUrl(blob)

  try {
    const downloadId = await browser.downloads.download({ url: downloadUrl, filename, saveAs: false, conflictAction: 'uniquify' })
    return downloadId
  }
  finally {
    if (blobUrl)
      URL.revokeObjectURL(blobUrl)
  }
}
