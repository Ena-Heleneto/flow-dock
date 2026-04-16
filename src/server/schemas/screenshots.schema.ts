/**
 * 截图数据库Schema定义
 * @description 定义截图存储的数据结构、索引和配置信息
 *
 * @property {string} id - 截图的唯一标识符
 * @property {number} ts - 截图的时间戳
 * @property {string} pageId - 所属页面的ID
 * @property {string} clusterId - 所属集群的ID
 * @property {string} mime - 截图的MIME类型
 * @property {object} blob - 截图的二进制数据
 * @property {number} width - 截图的宽度(像素)
 * @property {number} height - 截图的高度(像素)
 * @property {string} kind - 截图的类型/分类
 * @property {number} downloadId - 关联的下载ID
 * @property {string} localPath - 本地存储路径
 * @property {number} deletedAt - 删除时间戳，null表示未删除
 *
 * @remarks
 * - 主键为 `id` 字段
 * - 包含三个索引：pageId、clusterId、ts，用于优化查询性能
 * - 支持按页面、集群或时间范围快速检索截图
 */
export const ScreenshotSchema = defineSchemaHandler(
  {
    name: 'screenshots',
    options: { keyPath: 'id' },
    record: {
      id: { type: String },
      ts: { type: Number },
      pageId: { type: String },
      clusterId: { type: String },
      mime: { type: String },
      blob: { type: Blob },
      width: { type: Number },
      height: { type: Number },
      kind: { type: String },
      downloadId: { type: Number },
      localPath: { type: String },
      createdAt: { type: Number },
      updatedAt: { type: Number },
      deletedAt: { type: Number },
    },
    indexes: [
      { name: 'pageId', keyPath: 'pageId' },
      { name: 'clusterId', keyPath: 'clusterId' },
      { name: 'ts', keyPath: 'ts' },
    ],
  },
)
