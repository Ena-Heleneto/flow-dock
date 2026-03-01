export type SavePageInput = Partial<CreatePageInput>

export interface SavePageResult {
  page: PageRecord
  duplicated: boolean
}

export class PagesService {
  /**
   * 保存页面信息
   *
   * 从当前标签页获取URL、标题等信息，并结合输入参数创建页面记录。
   * 使用降级策略为缺失的字段提供默认值。
   *
   * @param input - 页面保存输入参数
   * @param input.url - 页面URL，默认使用当前标签页URL或 'about:blank'
   * @param input.route - 路由标识符，默认从URL推导
   * @param input.routeSig - 路由签名，默认从URL和route生成
   * @param input.system - 系统标识，默认从URL推导
   * @param input.module - 模块标识，默认从路由推导
   * @param input.pageType - 页面类型，默认为 'page'
   * @param input.tags - 页面标签列表，默认为空数组
   * @param input.title - 页面标题，默认使用当前标签页标题或route
   * @param input.clusterId - 集群ID，默认使用routeSig
   * @param input.fingerprints - 指纹信息，默认为空对象
   * @param input.summary - 页面摘要
   * @param input.diff - 页面差异信息
   * @param input.screenshotId - 截图ID
   *
   * @returns 返回创建的页面记录对象
   */
  async savePage(input: SavePageInput = {}): Promise<SavePageResult> {
    const tab = await getCurrentTab()
    const url = input.url ?? tab?.url ?? 'about:blank'
    const address = input.address ?? url
    const route = input.route ?? fallbackRoute(url)
    const routeSig = input.routeSig ?? fallbackRouteSig(url, route)

    const { createPage, listPages } = pagesSchema()

    const duplicatedPage = (await listPages()).find(page => page.address === address)
    if (duplicatedPage) {
      return {
        page: duplicatedPage,
        duplicated: true,
      }
    }

    const page = await createPage({
      system: input.system ?? fallbackSystem(url),
      module: input.module ?? fallbackModule(route),
      pageType: input.pageType ?? 'page',
      tags: input.tags ?? [],
      address,
      url,
      title: input.title ?? tab?.title ?? route,
      route,
      routeSig,
      clusterId: input.clusterId ?? routeSig,
      fingerprints: input.fingerprints ?? {},
      summary: input.summary,
      diff: input.diff,
      screenshotId: input.screenshotId,
      ts: Date.now(),
    })

    return {
      page,
      duplicated: false,
    }
  }
}
