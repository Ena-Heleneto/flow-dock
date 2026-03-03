/**
 * 页面与 OpenCV 检测结果关联表 Schema 定义
 * @description 存储 page 与 cv_detection 的关联关系，支持按页面快速读取检测结果
 *
 * @property {string} id - 关联唯一标识（建议: pageId|cvDetectionId）
 * @property {string} pageId - 页面ID
 * @property {string} screenshotId - 触发该检测的截图ID
 * @property {string} cvDetectionId - 检测结果ID
 * @property {string} role - 关联角色（可选，例如 primary / candidate）
 * @property {number} ts - 关联时间戳
 * @property {number} createdAt - 创建时间
 * @property {number} updatedAt - 更新时间
 * @property {number} deletedAt - 软删除时间
 */
export const PageCvDetectionsLinkSchema = defineSchemaHandler(
  {
    name: 'page_cv_detections_link',
    options: { keyPath: 'id' },
    record: {
      id: { type: String },
      pageId: { type: String },
      screenshotId: { type: String },
      cvDetectionId: { type: String },
      role: { type: String },
      ts: { type: Number },
      createdAt: { type: Number },
      updatedAt: { type: Number },
      deletedAt: { type: Number },
    },
    indexes: [
      { name: 'pageId', keyPath: 'pageId' },
      { name: 'screenshotId', keyPath: 'screenshotId' },
      { name: 'cvDetectionId', keyPath: 'cvDetectionId' },
      { name: 'ts', keyPath: 'ts' },
      { name: 'pageDetection', keyPath: ['pageId', 'cvDetectionId'], options: { unique: true } },
    ],
  },
)
