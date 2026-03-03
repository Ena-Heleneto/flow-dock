/**
 * 构建页面文档对象
 *
 * 根据提供的负载数据和当前标签页信息，构建一个符合 PageSchema 的页面文档。
 * 如果负载中未提供某些字段，将使用当前标签页的对应值或通过回退函数生成。
 *
 * @param payload - 页面文档的部分数据，包含 url、route、routeSig 等字段
 * @param currentTab - 当前标签页信息，包含 url 等属性
 * @returns 返回构建完成的页面文档对象，其中 routeSig 字段保证不为 undefined（默认为空字符串）
 */
function buildPageDocument(payload: Partial<SchemaRecordType<typeof PageSchema>>, currentTab: Awaited<ReturnType<typeof getCurrentTab>>) {
  const url = payload.url ?? currentTab?.url
  const route = payload.route ?? (url ? fallbackRoute(url) : undefined)
  const routeSig = payload.routeSig ?? (url && route ? fallbackRouteSig(url, route) : undefined)

  const pageDocument = buildDocument<typeof PageSchema>(PageSchema, {
    ...payload,
    ...(url ? { url } : {}),
    ...(route ? { route } : {}),
    routeSig,
  }, {
    strict: true,
  })

  return {
    ...pageDocument,
    routeSig: pageDocument.routeSig ?? '',
  }
}

type ScreenshotRecord = SchemaRecordType<typeof ScreenshotSchema>
type RequiredScreenshotPayloadFields = 'pageId' | 'blob' | 'mime'

type ScreenshotDocumentPayload = Omit<Partial<ScreenshotRecord>, RequiredScreenshotPayloadFields>
  & { [K in RequiredScreenshotPayloadFields]-?: NonNullable<ScreenshotRecord[K]> }
  & { screenShotsRelativePath?: string }

function toBlobMeta(value: unknown): { isBlob: boolean, size: number, mime: string } {
  if (value instanceof Blob)
    return { isBlob: true, size: value.size, mime: value.type }
  return { isBlob: false, size: 0, mime: '' }
}

function buildScreenshotDocument(payload: ScreenshotDocumentPayload): ScreenshotRecord {
  const ts = Date.now()
  const extension = payload.mime.includes('jpeg') ? 'jpg' : payload.mime.includes('webp') ? 'webp' : 'png'

  const screenshotDocument = buildDocument<typeof ScreenshotSchema>(ScreenshotSchema, {
    id: payload.id,
    pageId: payload.pageId,
    clusterId: payload.clusterId,
    blob: payload.blob,
    mime: payload.mime,
    width: payload.width ?? 0,
    height: payload.height ?? 0,
    kind: payload.kind ?? 'page',
    downloadId: payload.downloadId,
    ts,
    createdAt: ts,
    updatedAt: ts,
  }, {
    strict: true,
  }) as ScreenshotRecord

  const screenshotId = screenshotDocument.id ?? ''
  const basePath = payload.screenShotsRelativePath ?? ''
  const normalizedBase = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath
  const localPath = screenshotId
    ? (normalizedBase ? `${normalizedBase}/${screenshotId}.${extension}` : `/${screenshotId}.${extension}`)
    : undefined

  return {
    ...screenshotDocument,
    ...(localPath ? { localPath } : {}),
  }
}

/**
 * 构建截图链接文档对象
 *
 * 将传入的截图链接相关数据转换为符合 ScreenshotLinksSchema 规范的文档对象。
 * 自动添加时间戳信息，用于记录文档的创建和更新时间。
 *
 * @param payload - 截图链接的有效载荷数据
 * @param payload.screenshotId - 截图ID（必需）
 * @param payload.pageId - 页面ID（可选）
 * @param payload.componentId - 组件ID（可选）
 * @param payload.bundleId - 包ID（可选）
 *
 * @returns 返回构建好的截图链接文档对象，类型遵循 ScreenshotLinksSchema 规范
 */
function buildScreenshotLinksDocument(payload: Parameters<ScreenshotLinksService<typeof ScreenshotLinksSchema>['saveScreenshotLinks']>[0]
  & {
    screenshotId: string
    pageId?: string
    componentId?: string
    bundleId?: string
  }) {
  const ts = Date.now()

  return buildDocument<typeof ScreenshotLinksSchema>(ScreenshotLinksSchema, {
    screenshotId: payload.screenshotId,
    pageId: payload.pageId,
    componentId: payload.componentId,
    bundleId: payload.bundleId,
    ts,
    createdAt: ts,
    updatedAt: ts,
  }, {
    strict: true,
  })
}

export default defineEventHandler(async (event) => {
  const FLOW_DOCK_DB_NAME = 'flow-dock-dev'

  const transactionIdb = new IdbTransactionUtil({ dbName: FLOW_DOCK_DB_NAME, version: 1, stores: [PageSchema, KvConfigsSchema, ScreenshotSchema, ScreenshotLinksSchema] })
  const pagesService = new PagesService(transactionIdb, PageSchema)
  const kvConfigsService = new KvConfigsService(transactionIdb, KvConfigsSchema)
  const screenshotsService = new ScreenshotsService(transactionIdb, ScreenshotSchema)
  const screenshotLinksService = new ScreenshotLinksService(transactionIdb, ScreenshotLinksSchema)
  try {
    const _body = readBody<Parameters<typeof buildPageDocument>[0]>(event) ?? {}
    const currentTab = await getCurrentTab()
    const pageDocument = buildPageDocument(_body, currentTab)
    const pageId = pageDocument.id ?? createId()
    const pageRouteSig = pageDocument.routeSig

    await transactionIdb.start()

    if (pageRouteSig) {
      const _exists = await pagesService.exists({ indexName: 'routeSig', query: pageRouteSig, count: 1 })
      if (_exists) {
        await transactionIdb.done()
        logger.success('Page already exists, skipping save', { routeSig: pageRouteSig })
        return { code: 0, data: null, message: 'page already exists' }
      }
    }

    const firstConfig = ((await kvConfigsService.readConfig())[0] ?? {}) as {
      screenShotsRelativePath?: string
      screenShotsLocalPath?: string
    }
    await transactionIdb.done()

    const screenshotCapture = await captureFullPageTab(currentTab?.id, currentTab?.windowId)

    const screenshotBasePath = firstConfig.screenShotsLocalPath ?? 'flow-dock/screenshots'

    const screenshotDocument = buildScreenshotDocument({
      pageId,
      clusterId: pageDocument.clusterId,
      blob: screenshotCapture.blob,
      mime: screenshotCapture.mime,
      width: screenshotCapture.width,
      height: screenshotCapture.height,
      kind: 'page',
      screenShotsRelativePath: screenshotBasePath,
    })

    const screenshotId = String(screenshotDocument.id ?? '')
    let downloadId: number | undefined
    try {
      downloadId = await downloadScreenshot(
        screenshotCapture.blob,
        screenshotCapture.mime,
        screenshotId,
        screenshotBasePath,
      )
    }
    catch (error: unknown) {
      logger.warn('Failed to download screenshot, continue saving db records', error)
    }

    await transactionIdb.start()

    const screenshotToSave = { ...screenshotDocument, downloadId }
    await screenshotsService.saveScreenshot(screenshotToSave)

    const pageToSave = { ...pageDocument, id: pageId, ...(screenshotId ? { screenshotId } : {}) }

    await screenshotLinksService.saveScreenshotLinks(buildScreenshotLinksDocument({ screenshotId, pageId }))

    const id = await pagesService.save(pageToSave)

    const persistedScreenshot = screenshotId
      ? await ScreenshotSchema.readById(transactionIdb.getCurrent(), screenshotId)
      : undefined
    const screenshotBlobMeta = toBlobMeta((persistedScreenshot as { blob?: unknown } | undefined)?.blob)

    await transactionIdb.done()

    logger.success('Page document and screenshot saved', { id, routeSig: pageRouteSig, screenshotId, screenshotBlobMeta })
    return {
      code: 0,
      data: { id, page: pageToSave, screenshot: screenshotToSave, screenshotBlobMeta, captureBlobMeta: toBlobMeta(screenshotCapture.blob), downloadId },
      message: 'success',
    }
  }
  catch (error: unknown) {
    logger.error('Failed to save page data', error)
    transactionIdb.abort()
    return { code: -1, data: null, message: error instanceof Error ? error.message : 'failed to save page data' }
  }
})
