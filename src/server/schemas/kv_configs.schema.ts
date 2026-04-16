/**
 * 键值配置存储的数据库Schema定义
 * @remarks
 * 定义了KV配置数据的结构、索引和存储选项
 *
 * @property {string} id - 配置的唯一标识符，作为主键
 * @property {string} dbName - 数据库名称
 * @property {string} screenShotsRelativePath - 截图文件的相对路径
 * @property {string} screenShotsLocalPath - 截图导出到浏览器下载目录时使用的相对路径
 * @property {number} createdAt - 创建时间戳（毫秒）
 * @property {number} updatedAt - 更新时间戳（毫秒），已建立索引用于快速查询
 * @property {number} deletedAt - 删除时间戳（毫秒），用于软删除标记
 */
export const KvConfigsSchema = defineSchemaHandler(
  {
    name: 'kv_configs',
    options: { keyPath: 'id' },
    record: {
      id: { type: String },
      screenShotsRelativePath: { type: String },
      screenShotsLocalPath: { type: String },
      createdAt: { type: Number },
      updatedAt: { type: Number },
      deletedAt: { type: Number },
    },
    indexes: [
      { name: 'updatedAt', keyPath: 'updatedAt' },
    ],
  },
)
