/**
 * 分析检测项
 * @typedef {object} AnalyzeDetectionItem
 * @property {string} label - 检测项的标签名称
 * @property {number} confidence - 检测的置信度，范围通常为 0-1
 * @property {object} bbox - 检测框的边界信息
 * @property {number} bbox.x - 检测框左上角的 X 坐标
 * @property {number} bbox.y - 检测框左上角的 Y 坐标
 * @property {number} bbox.width - 检测框的宽度
 * @property {number} bbox.height - 检测框的高度
 */
interface AnalyzeDetectionItem {
  label: string
  confidence: number
  bbox: { x: number, y: number, width: number, height: number }
}

interface BoxedScreenshotInput {
  blob: Blob
  detections: AnalyzeDetectionItem[]
  sourceWidth?: number
  sourceHeight?: number
}

interface BoxedScreenshotResult {
  blob: Blob
  width: number
  height: number
  mime: string
}

type CvDetectionDocumentPayload = Pick<
  SchemaRecordType<typeof CvDetectionsSchema>,
  'screenshotId' | 'runId' | 'label' | 'confidence' | 'bbox'
>

type PageCvDetectionLinkDocumentPayload = Pick<
  SchemaRecordType<typeof PageCvDetectionsLinkSchema>,
  'pageId' | 'screenshotId' | 'cvDetectionId'
> & {
  role?: SchemaRecordType<typeof PageCvDetectionsLinkSchema>['role']
}

/**
 * 构建CV检测文档对象
 *
 * 该函数创建一个符合CvDetectionsSchema结构的检测文档，用于存储计算机视觉检测的结果。
 *
 * @param payload - 检测数据负载对象
 * @param payload.screenshotId - 截图的唯一标识符
 * @param payload.runId - 运行的唯一标识符
 * @param payload.label - 检测到的对象标签/类别
 * @param payload.confidence - 检测的置信度得分（0-1之间）
 * @param payload.bbox - 边界框对象，表示检测到的对象位置和大小
 * @param payload.bbox.x - 边界框左上角的X坐标
 * @param payload.bbox.y - 边界框左上角的Y坐标
 * @param payload.bbox.width - 边界框的宽度
 * @param payload.bbox.height - 边界框的高度
 *
 * @returns 返回一个类型化的检测文档对象，包含检测信息和时间戳
 */
function buildCvDetectionDocument(payload: CvDetectionDocumentPayload) {
  const ts = Date.now()
  return buildDocument<typeof CvDetectionsSchema>(CvDetectionsSchema, {
    screenshotId: payload.screenshotId,
    ts,
    detector: 'dom-layout',
    detectorVersion: 'v1',
    label: payload.label,
    confidence: payload.confidence,
    bbox: payload.bbox,
    runId: payload.runId,
    createdAt: ts,
    updatedAt: ts,
  }, {
    strict: true,
  })
}

/**
 * 构建页面CV检测链接文档
 *
 * @param payload - 构建文档所需的参数对象
 * @param payload.pageId - 页面ID
 * @param payload.screenshotId - 截图ID
 * @param payload.cvDetectionId - CV检测ID
 * @param payload.role - 角色类型，默认值为 'primary'
 * @returns 返回构建好的页面CV检测链接文档对象
 *
 */
function buildPageCvDetectionLinkDocument(payload: PageCvDetectionLinkDocumentPayload) {
  const ts = Date.now()
  return buildDocument<typeof PageCvDetectionsLinkSchema>(PageCvDetectionsLinkSchema, {
    pageId: payload.pageId,
    screenshotId: payload.screenshotId,
    cvDetectionId: payload.cvDetectionId,
    role: payload.role ?? 'primary',
    ts,
    createdAt: ts,
    updatedAt: ts,
  }, {
    strict: true,
  })
}

/**
 * 规范化分析检测数据
 *
 * 将未知类型的值转换为标准的检测项数组。如果输入不是数组或包含无效的检测项，
 * 这些项将被过滤掉。对于缺失的字段，使用默认值进行填充。
 *
 * @param value - 待规范化的未知类型值
 * @returns 规范化后的检测项数组。如果输入不是数组，返回空数组
 *
 * @remarks
 * - 如果项不是对象或缺少 bbox，则被过滤掉
 * - bbox 的 x, y, width, height 必须能转换为有效的数字，否则项被过滤
 * - label 默认值为 'component'（当不是字符串时）
 * - confidence 默认值为 0.5（当不是数字时）
 */
function normalizeAnalyzeDetections(value: unknown): AnalyzeDetectionItem[] {
  if (!Array.isArray(value))
    return []

  return value
    .map((item) => {
      if (!item || typeof item !== 'object')
        return null
      const raw = item as {
        label?: unknown
        confidence?: unknown
        bbox?: { x?: unknown, y?: unknown, width?: unknown, height?: unknown }
      }
      const bbox = raw.bbox
      if (!bbox)
        return null
      const x = Number(bbox.x)
      const y = Number(bbox.y)
      const width = Number(bbox.width)
      const height = Number(bbox.height)
      if ([x, y, width, height].some(Number.isNaN))
        return null

      return {
        label: typeof raw.label === 'string' ? raw.label : 'component',
        confidence: typeof raw.confidence === 'number' ? raw.confidence : 0.5,
        bbox: { x, y, width, height },
      }
    })
    .filter((item): item is AnalyzeDetectionItem => item !== null)
}

async function drawBoxedScreenshot(input: BoxedScreenshotInput): Promise<BoxedScreenshotResult> {
  const sourceMime = input.blob.type || 'image/png'
  if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap !== 'function') {
    return {
      blob: input.blob,
      width: input.sourceWidth ?? 0,
      height: input.sourceHeight ?? 0,
      mime: sourceMime,
    }
  }

  const bitmap = await createImageBitmap(input.blob)
  try {
    const width = bitmap.width
    const height = bitmap.height
    const canvas = new OffscreenCanvas(width, height)
    const context = canvas.getContext('2d')
    if (!context) {
      return {
        blob: input.blob,
        width,
        height,
        mime: sourceMime,
      }
    }

    context.drawImage(bitmap, 0, 0)

    const sourceWidth = input.sourceWidth && input.sourceWidth > 0 ? input.sourceWidth : width
    const sourceHeight = input.sourceHeight && input.sourceHeight > 0 ? input.sourceHeight : height
    const scaleX = sourceWidth > 0 ? width / sourceWidth : 1
    const scaleY = sourceHeight > 0 ? height / sourceHeight : 1

    context.strokeStyle = '#7c3cff'
    context.fillStyle = 'rgba(124, 60, 255, 0.08)'
    context.lineWidth = 2

    for (const item of input.detections) {
      const left = Math.max(0, Math.round(item.bbox.x * scaleX))
      const top = Math.max(0, Math.round(item.bbox.y * scaleY))
      const boxWidth = Math.max(1, Math.round(item.bbox.width * scaleX))
      const boxHeight = Math.max(1, Math.round(item.bbox.height * scaleY))

      context.fillRect(left, top, boxWidth, boxHeight)
      context.strokeRect(left, top, boxWidth, boxHeight)
    }

    const blob = await canvas.convertToBlob({ type: 'image/png' })
    return {
      blob,
      width,
      height,
      mime: blob.type || 'image/png',
    }
  }
  finally {
    bitmap.close()
  }
}

function readStatsSize(stats: unknown) {
  if (!stats || typeof stats !== 'object')
    return { width: 0, height: 0 }

  const value = stats as { width?: unknown, height?: unknown }
  const width = Number(value.width)
  const height = Number(value.height)
  return {
    width: Number.isFinite(width) ? width : 0,
    height: Number.isFinite(height) ? height : 0,
  }
}

/**
 * 收集页面DOM元素的检测信息
 *
 * 该函数通过在指定标签页中执行脚本，扫描页面上的DOM元素并提取其位置和尺寸信息。
 * 扫描的元素包括语义化标签（main、section等）、交互元素（button、input等）、
 * 以及包含特定属性的元素（data-testid、class*="card"等）。
 *
 * @param {number} tabId - 浏览器标签页的ID
 * @returns {Promise<{
 *   detections: Array<{label: string, confidence: number, bbox: {x: number, y: number, width: number, height: number}}>,
 *   stats: {contourCount: number, keptCount: number, width: number, height: number} | null
 * }>}
 * 返回包含以下信息的对象：
 * - detections: 检测到的元素数组，每个元素包含标签名、置信度和边界框
 * - stats: 统计信息，包括候选元素总数、保留元素数、页面宽度和高度
 *
 * @remarks
 * - 会过滤掉宽度<32px或高度<24px的元素
 * - 会去重相同位置和尺寸的元素
 * - 最多返回400个检测结果
 * - 所有坐标考虑了页面滚动偏移
 */
async function collectDomDetections(tabId: number) {
  const [result] = await browser.scripting.executeScript({
    target: { tabId },
    func: () => {
      const candidates = Array.from(document.querySelectorAll(
        [
          'main',
          'section',
          'article',
          'aside',
          'nav',
          'header',
          'footer',
          'form',
          'table',
          'figure',
          '[role="button"]',
          'button',
          'input',
          'textarea',
          'select',
          '[data-testid]',
          '[class*="card"]',
          '[class*="item"]',
          '[class*="panel"]',
        ].join(','),
      ))

      const seen = new Set<string>()
      const detections = candidates
        .map((element) => {
          const rect = element.getBoundingClientRect()
          if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height))
            return null
          if (rect.width < 32 || rect.height < 24)
            return null

          const x = Math.max(0, rect.left + window.scrollX)
          const y = Math.max(0, rect.top + window.scrollY)
          const width = Math.max(1, rect.width)
          const height = Math.max(1, rect.height)
          const key = `${Math.round(x)}:${Math.round(y)}:${Math.round(width)}:${Math.round(height)}`
          if (seen.has(key))
            return null

          seen.add(key)
          const tag = (element.tagName || 'element').toLowerCase()
          return { label: tag, confidence: 0.5, bbox: { x, y, width, height } }
        })
        .filter(item => item !== null)
        .slice(0, 400)

      const documentElement = document.documentElement
      const body = document.body
      const pageWidth = Math.max(window.innerWidth, documentElement?.scrollWidth ?? 0, body?.scrollWidth ?? 0)
      const pageHeight = Math.max(window.innerHeight, documentElement?.scrollHeight ?? 0, body?.scrollHeight ?? 0)

      return {
        detections,
        stats: {
          contourCount: candidates.length,
          keptCount: detections.length,
          width: pageWidth,
          height: pageHeight,
        },
      }
    },
  })

  return {
    detections: normalizeAnalyzeDetections((result?.result as { detections?: unknown } | undefined)?.detections),
    stats: (result?.result as { stats?: unknown } | undefined)?.stats ?? null,
  }
}

export default defineEventHandler(async (_event: unknown) => {
  const FLOW_DOCK_DB_NAME = 'flow-dock-dev'
  const transactionIdb = new IdbTransactionUtil({ dbName: FLOW_DOCK_DB_NAME, version: 1, stores: [PageSchema, KvConfigsSchema, ScreenshotSchema, ScreenshotLinksSchema, CvDetectionsSchema, PageCvDetectionsLinkSchema] })
  try {
    const currentTab = await getCurrentTab()
    const url = currentTab?.url ?? ''
    const route = url ? fallbackRoute(url) : '/'
    const routeSig = url ? fallbackRouteSig(url, route) : route

    const transaction = await transactionIdb.start()
    const { records } = await linkedFindByCriteria(transaction, [
      { schema: PageSchema, indexName: 'routeSig', query: routeSig, count: 1 },
      { schema: ScreenshotLinksSchema, indexName: 'pageId', queryFrom: 'id', count: 1 },
    ])

    const [page, screenshotLink] = records as [{ id?: string } | null, { screenshotId?: string } | null]
    const pageId = page?.id ?? ''
    const screenshotId = screenshotLink?.screenshotId ?? ''

    if (!pageId || !screenshotId) {
      await transactionIdb.done()
      return {
        code: -1,
        data: { url, route, routeSig, pageId, screenshotId },
        message: 'page or screenshot not found',
      }
    }

    const screenshot = await ScreenshotSchema.readById(transaction, screenshotId)
    if (!screenshot) {
      await transactionIdb.done()
      return {
        code: -1,
        data: { url, route, routeSig, pageId, screenshotId },
        message: 'screenshot not found',
      }
    }

    const firstConfig = ((await KvConfigsSchema.findAll(transaction))[0] ?? {}) as {
      screenShotsLocalPath?: string
    }

    await transactionIdb.done()

    const currentTabId = currentTab?.id
    if (typeof currentTabId !== 'number') {
      return {
        code: -1,
        data: { url, route, routeSig, pageId, screenshotId },
        message: 'active tab not found for analyze',
      }
    }

    const analyzeResult = await collectDomDetections(currentTabId)
    const detections = analyzeResult.detections

    if (!(screenshot.blob instanceof Blob)) {
      return {
        code: -1,
        data: { url, route, routeSig, pageId, screenshotId },
        message: 'screenshot blob is invalid',
      }
    }

    const runId = createId()
    const persistedDetectionIds: string[] = []
    const statsSize = readStatsSize(analyzeResult.stats)

    const boxedScreenshot = await drawBoxedScreenshot({
      blob: screenshot.blob,
      detections,
      sourceWidth: Number(statsSize.width || screenshot.width || 0),
      sourceHeight: Number(statsSize.height || screenshot.height || 0),
    })

    const boxedScreenshotDocument = buildDocument<typeof ScreenshotSchema>(ScreenshotSchema, {
      pageId,
      clusterId: screenshot.clusterId,
      blob: boxedScreenshot.blob,
      mime: boxedScreenshot.mime,
      width: boxedScreenshot.width,
      height: boxedScreenshot.height,
      kind: 'page-boxed',
      ts: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }, {
      strict: true,
    })

    const boxedScreenshotId = String(boxedScreenshotDocument.id ?? '')
    if (!boxedScreenshotId) {
      return {
        code: -1,
        data: { url, route, routeSig, pageId, screenshotId },
        message: 'boxed screenshot id is invalid',
      }
    }

    const boxedScreenshotBasePath = firstConfig.screenShotsLocalPath ?? 'flow-dock/screenshots'
    let boxedDownloadId: number | undefined
    try {
      boxedDownloadId = await downloadScreenshot(
        boxedScreenshot.blob,
        boxedScreenshot.mime,
        boxedScreenshotId,
        boxedScreenshotBasePath,
      )
    }
    catch (error: unknown) {
      logger.warn('Failed to download boxed screenshot, continue saving db records', error)
    }

    const boxedLocalPath = buildLocalPath(boxedScreenshotBasePath, boxedScreenshotId, boxedScreenshot.mime)

    await transactionIdb.start()

    await ScreenshotSchema.create(transactionIdb.getCurrent(), {
      ...boxedScreenshotDocument,
      downloadId: boxedDownloadId,
      ...(boxedLocalPath ? { localPath: boxedLocalPath } : {}),
    })

    for (const item of detections) {
      const detectionDocument = buildCvDetectionDocument({
        screenshotId,
        runId,
        label: item.label,
        confidence: item.confidence,
        bbox: item.bbox,
      })

      const cvDetectionId = String(detectionDocument.id ?? '')
      if (!cvDetectionId)
        continue

      await CvDetectionsSchema.create(transactionIdb.getCurrent(), detectionDocument)
      await PageCvDetectionsLinkSchema.create(
        transactionIdb.getCurrent(),
        buildPageCvDetectionLinkDocument({ pageId, screenshotId, cvDetectionId }),
      )

      persistedDetectionIds.push(cvDetectionId)
    }

    await transactionIdb.done()

    return {
      code: 0,
      data: {
        url,
        route,
        routeSig,
        pageId,
        screenshotId,
        boxedScreenshotId,
        boxedDownloadId,
        boxedLocalPath,
        runId,
        totalDetections: detections.length,
        persistedDetections: persistedDetectionIds.length,
        detectionIds: persistedDetectionIds,
        stats: analyzeResult.stats,
      },
      message: 'success',
    }
  }
  catch (error) {
    logger.error('Failed to analyze page screenshot', error)
    transactionIdb.abort()
    return { code: -1, data: null, message: 'failed to analyze page screenshot' }
  }
})
