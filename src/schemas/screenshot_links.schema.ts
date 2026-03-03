/**
 * 截图链接数据库schema定义
 *
 * @description 定义截图链接存储对象的结构，包括字段类型、主键和索引配置
 *
 * @schema
 * - id: 主键，类型为字符串
 * - screenshotId: 截图ID，类型为字符串，具有唯一约束
 * - pageId: 页面ID，类型为字符串，具有唯一约束
 * - componentId: 组件ID，类型为字符串，具有唯一约束
 * - bundleId: 包ID，类型为字符串，具有唯一约束
 * - ts: 时间戳，类型为数字，用于排序和查询
 * - deletedAt: 删除时间戳，类型为数字，用于软删除标记
 *
 * @indexes
 * - screenshotId索引: 唯一索引，用于快速查询特定截图
 * - pageId索引: 唯一索引，用于快速查询特定页面
 * - componentId索引: 唯一索引，用于快速查询特定组件
 * - bundleId索引: 唯一索引，用于快速查询特定包
 * - ts索引: 普通索引，用于按时间戳排序和范围查询
 *
 * @returns 返回配置好的schema处理器
 */
export const ScreenshotLinksSchema = defineSchemaHandler(
  {
    name: 'screenshot_links',
    options: { keyPath: 'id' },
    record: {
      id: { type: String },
      screenshotId: { type: String },
      pageId: { type: String },
      componentId: { type: String },
      bundleId: { type: String },
      ts: { type: Number },
      createdAt: { type: Number },
      updatedAt: { type: Number },
      deletedAt: { type: Number },
    },
    indexes: [
      { name: 'screenshotId', keyPath: 'screenshotId', options: { unique: true } },
      { name: 'pageId', keyPath: 'pageId', options: { unique: true } },
      { name: 'componentId', keyPath: 'componentId', options: { unique: true } },
      { name: 'bundleId', keyPath: 'bundleId', options: { unique: true } },
      { name: 'ts', keyPath: 'ts' },
    ],
  },
)
