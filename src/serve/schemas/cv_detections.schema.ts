/**
 * OpenCV 检测结果表 Schema 定义
 * @description 存储截图分析后的结构化检测结果
 *
 * @property {string} id - 检测结果唯一标识
 * @property {string} screenshotId - 来源截图ID
 * @property {number} ts - 检测时间戳
 * @property {string} detector - 检测器名称（例如 opencv-template-match / opencv-contour）
 * @property {string} detectorVersion - 检测器版本
 * @property {string} label - 检测标签（例如 button / input / icon）
 * @property {number} confidence - 置信度（0-1）
 * @property {object} bbox - 外接框信息
 * @property {number} bbox.x - 左上角横坐标
 * @property {number} bbox.y - 左上角纵坐标
 * @property {number} bbox.width - 宽度
 * @property {number} bbox.height - 高度
 * @property {string} ocrText - OCR文本（可选）
 * @property {string} fingerprint - 检测特征摘要（可选）
 * @property {string} runId - 分析任务批次ID（可选）
 * @property {number} createdAt - 创建时间
 * @property {number} updatedAt - 更新时间
 * @property {number} deletedAt - 软删除时间
 */
export const CvDetectionsSchema = defineSchemaHandler(
  {
    name: 'cv_detections',
    options: { keyPath: 'id' },
    record: {
      id: { type: String },
      screenshotId: { type: String },
      ts: { type: Number },
      detector: { type: String },
      detectorVersion: { type: String },
      label: { type: String },
      confidence: { type: Number },
      bbox: {
        type: {
          x: { type: Number },
          y: { type: Number },
          width: { type: Number },
          height: { type: Number },
        },
      },
      ocrText: { type: String },
      fingerprint: { type: String },
      runId: { type: String },
      createdAt: { type: Number },
      updatedAt: { type: Number },
      deletedAt: { type: Number },
    },
    indexes: [
      { name: 'screenshotId', keyPath: 'screenshotId' },
      { name: 'label', keyPath: 'label' },
      { name: 'detector', keyPath: 'detector' },
      { name: 'runId', keyPath: 'runId' },
      { name: 'confidence', keyPath: 'confidence' },
      { name: 'ts', keyPath: 'ts' },
      { name: 'screenshotLabel', keyPath: ['screenshotId', 'label'] },
    ],
  },
)
