/**
 * 页面数据模式定义
 *
 * @description 定义了页面（Page）数据结构的数据库模式，用于存储页面的各类信息
 *
 * @property {string} id - 页面唯一标识符
 * @property {number} ts - 时间戳，记录页面数据的时间
 * @property {string} system - 所属系统标识
 * @property {string} module - 所属模块标识
 * @property {string} pageType - 页面类型
 * @property {string[]} tags - 页面标签数组
 * @property {string} address - 页面地址
 * @property {string} url - 页面URL
 * @property {string} title - 页面标题
 * @property {string} route - 页面路由
 * @property {string} routeSig - 路由签名，用于路由匹配和识别
 * @property {string} clusterId - 聚类ID，用于页面聚类分组
 * @property {object} fingerprints - 页面指纹对象，用于页面识别和去重
 * @property {object} summary - 页面摘要信息
 * @property {string[]} summary.parts - 页面内容部分数组
 * @property {string[]} summary.texts - 页面文本内容数组
 * @property {string} summary.theme - 页面主题
 * @property {string} diff - 页面差异信息
 * @property {number} deletedAt - 删除时间戳，标记页面逻辑删除时间
 * @property {string} screenshotId - 页面截图ID
 *
 * @remarks
 * 数据库使用 `id` 作为主键
 * 建立了以下索引：routeSig、clusterId、system、pageType、ts
 */
export const PageSchema = defineSchemaHandler(
  {
    name: 'pages',
    options: { keyPath: 'id' },
    record: {
      id: { type: String },
      ts: { type: Number },
      system: { type: String },
      module: { type: String },
      pageType: { type: String },
      tags: { type: Array, subType: String },
      address: { type: String },
      url: { type: String },
      title: { type: String },
      route: { type: String },
      routeSig: { type: String },
      clusterId: { type: String },
      fingerprints: { type: Object },
      summary: {
        type: {
          parts: { type: Array, subType: String },
          texts: { type: Array, subType: String },
          theme: { type: String },
        },
      },
      diff: { type: String },
      deletedAt: { type: Number },
      screenshotId: { type: String },
    },

    indexes: [
      { name: 'routeSig', keyPath: 'routeSig' },
      { name: 'clusterId', keyPath: 'clusterId' },
      { name: 'system', keyPath: 'system' },
      { name: 'pageType', keyPath: 'pageType' },
      { name: 'ts', keyPath: 'ts' },
    ],
  },
)
