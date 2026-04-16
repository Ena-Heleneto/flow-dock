/**
 * 预览行数据接口
 * @interface PreviewRow
 * @property {unknown} key - 行的键值，可以是任意类型
 * @property {string} keyText - 行键的文本表示形式
 * @property {unknown} value - 行的值，可以是任意类型
 */
export interface PreviewRow { key: unknown, keyText: string, value: unknown }
