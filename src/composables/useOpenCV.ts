import cvModule from '@techstark/opencv-js'

export function useOpenCV() {
  let cvPromise: Promise<any> | null = null

  /**
   * 初始化 OpenCV 模块
   * @returns {Promise<any>} 返回初始化后的 OpenCV 模块实例
   * @throws {Error} 如果初始化超过 15 秒则抛出超时错误
   * @remarks
   * - 如果已经初始化过，则直接返回缓存的 Promise
   * - 支持 Promise 形式和直接形式的 cvModule
   * - 等待 OpenCV 运行时初始化完成（通过 onRuntimeInitialized 回调）
   * - 如果运行时初始化失败，会进入轮询模式，每 50ms 检查一次 cv.Mat 是否可用
   * - 总超时时间为 15 秒
   */
  function init() {
    if (cvPromise)
      return cvPromise

    cvPromise = (async () => {
      let cv: any
      if (cvModule instanceof Promise) {
        cv = await cvModule
        return cv
      }
      cv = cvModule
      if (cv?.Mat)
        return cv
      try {
        await new Promise<void>(resolve =>
          cv.onRuntimeInitialized = () => resolve(),
        )
        if (cv?.Mat)
          return cv
      }
      catch (error) {
        console.warn('OpenCV init error:', error)
      }

      const start = Date.now()
      while (!cv?.Mat) {
        if (Date.now() - start > 15000)
          throw new Error('OpenCV init timeout')
        await new Promise(r => setTimeout(r, 50))
      }
      return cv
    })()

    return cvPromise
  }

  /**
   * 将数据URL转换为ImageBitmap对象
   * @param dataUrl - 数据URL字符串（如 data:image/png;base64,...）
   * @returns 返回Promise<ImageBitmap>，用于图像渲染或处理
   * @throws 如果fetch或createImageBitmap操作失败会抛出错误
   */
  async function dataUrlToImageBitmap(dataUrl: string) {
    const res = await fetch(dataUrl)
    const blob = await res.blob()
    return await createImageBitmap(blob)
  }

  return { init, dataUrlToImageBitmap }
}
