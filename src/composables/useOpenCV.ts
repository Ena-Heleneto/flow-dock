export function useOpenCV() {
  const defaultAnalyzeOptions: Required<Omit<OpenCVAnalyzeOptions, 'drawColor'>> & { drawColor: [number, number, number, number] } = {
    cannyThreshold1: 60,
    cannyThreshold2: 160,
    minArea: 250,
    minWidth: 16,
    minHeight: 16,
    maxAspectRatio: 10,
    drawColor: [124, 60, 255, 255],
    drawThickness: 2,
  }

  /**
   * 创建并初始化应用状态对象
   * @returns {State} 返回应用的响应式状态对象，包含所有全局状态管理数据
   */
  const state = createState()

  /**
   * 创建并返回一个初始化的 OpenCV 状态对象
   * @returns {OpenCVState} 包含所有图像处理中间结果的状态对象
   *   - source: 原始图像源
   *   - gray: 灰度转换后的图像
   *   - denoised: 去噪处理后的图像
   *   - edges: 边缘检测结果
   *   - morph: 形态学操作结果
   *   - contours: 轮廓检测结果
   *   - hierarchy: 轮廓层级信息
   *   - boxed: 包含边界框的图像
   *   - detections: 检测结果数组
   */
  function createState(): OpenCVState {
    return { source: null, gray: null, denoised: null, edges: null, morph: null, contours: null, hierarchy: null, boxed: null, detections: [] }
  }

  /**
   * 安全地删除 OpenCV Mat 对象及其相关资源
   *
   * 该函数检查传入的对象是否存在 delete 方法，如果存在则调用它来释放 Mat 对象占用的内存。
   * 这是一个防御性的包装函数，可以避免在删除未定义或不支持删除的对象时出现错误。
   *
   * @param matLike - 类似 OpenCV Mat 的对象，应该包含 delete 方法用于释放资源
   */
  function safeDelete(matLike: unknown) {
    if (matLike && typeof (matLike as { delete?: unknown }).delete === 'function')
      (matLike as { delete: () => void }).delete()
  }

  /**
   * 清理并释放OpenCV处理状态中的所有Mat对象
   * @param state - 包含各种OpenCV Mat对象的状态对象
   * @remarks
   * 此函数会安全地删除状态对象中的以下图像矩阵：
   * - source: 原始图像
   * - gray: 灰度图像
   * - denoised: 去噪图像
   * - edges: 边缘检测结果
   * - morph: 形态学处理结果
   * - contours: 轮廓数据
   * - hierarchy: 轮廓层级数据
   * - boxed: 绘制边界框后的图像
   */
  function finalizeState(state: OpenCVState) {
    safeDelete(state.source)
    safeDelete(state.gray)
    safeDelete(state.denoised)
    safeDelete(state.edges)
    safeDelete(state.morph)
    safeDelete(state.contours)
    safeDelete(state.hierarchy)
    safeDelete(state.boxed)
  }

  /**
   * 异步解析并初始化 OpenCV 模块
   *
   * 该函数动态导入 OpenCV.js 库，并确保模块完全初始化后返回
   * 支持以下场景：
   * - 模块导出为 Promise 的情况
   * - 模块包含 onRuntimeInitialized 回调的情况
   * - 普通模块导出的情况
   *
   * @async
   * @returns {Promise<unknown>} 返回初始化完成的 OpenCV 模块对象
   */
  async function resolveCv() {
    const cvModule = await import('@techstark/opencv-js')
    const cvExport = (cvModule as { default?: unknown }).default ?? cvModule

    if (cvExport instanceof Promise)
      return await cvExport

    const cvLike = cvExport as { onRuntimeInitialized?: (() => void) | null }
    if (typeof cvLike?.onRuntimeInitialized === 'function') {
      return await new Promise((resolve) => {
        const previous = cvLike.onRuntimeInitialized
        cvLike.onRuntimeInitialized = () => {
          previous?.()
          resolve(cvLike)
        }
      })
    }

    return cvExport
  }

  /**
   * 将 OpenCV Mat 对象转换为 ImageData 对象
   * @param cv - OpenCV 库实例
   * @param inputMat - 输入的 OpenCV Mat 对象
   * @returns 转换后的 ImageData 对象
   * @description
   * 该函数将 OpenCV 的 Mat 对象转换为浏览器原生的 ImageData 格式。
   * 如果输入是 4 通道（RGBA）的图像，直接转换；
   * 如果是 1 通道（灰度）图像，使用 COLOR_GRAY2RGBA 转换；
   * 如果是 3 通道（RGB）图像，使用 COLOR_RGB2RGBA 转换。
   * @remarks
   * 函数会自动释放临时创建的 Mat 对象内存，避免内存泄漏。
   */
  function toImageDataFromMat(cv: any, inputMat: any): ImageData {
    const channels = inputMat.channels()
    if (channels === 4)
      return new ImageData(new Uint8ClampedArray(inputMat.data), inputMat.cols, inputMat.rows)

    const rgba = new cv.Mat()
    if (channels === 1)
      cv.cvtColor(inputMat, rgba, cv.COLOR_GRAY2RGBA)
    else
      cv.cvtColor(inputMat, rgba, cv.COLOR_RGB2RGBA)

    const output = new ImageData(new Uint8ClampedArray(rgba.data), rgba.cols, rgba.rows)
    rgba.delete()
    return output
  }

  /**
   * 读取图像数据并转换为 OpenCV Mat 对象
   * @param input - 输入的图像数据，可以是 ImageData、HTMLCanvasElement 或 HTMLImageElement
   * @returns 返回转换后的 OpenCV Mat 对象
   * @async
   */
  async function read(input: ImageData | HTMLCanvasElement | HTMLImageElement) {
    const cv = await resolveCv()
    state.source = input instanceof ImageData
      ? cv.matFromImageData(input)
      : cv.imread(input)
    return state.source
  }

  /**
   * 将源图像转换为灰度图
   * @throws {Error} 当OpenCV源Mat未被初始化时抛出错误
   * @returns {Promise<any>} 返回转换后的灰度图Mat对象
   */
  async function toGray() {
    const cv = await resolveCv()
    if (!state.source)
      throw new Error('OpenCV source mat is not initialized')

    const gray = new cv.Mat()
    cv.cvtColor(state.source, gray, cv.COLOR_RGBA2GRAY)
    state.gray = gray
    return gray
  }

  /**
   * 对灰度图像进行去噪处理
   *
   * 该函数使用高斯模糊算法对已初始化的灰度图像进行去噪，
   * 并将处理结果保存到状态中。
   *
   * @async
   * @function denoise
   * @returns {Promise<cv.Mat>} 去噪后的图像矩阵
   * @throws {Error} 当灰度图像未初始化时抛出错误
   */
  async function denoise() {
    const cv = await resolveCv()
    if (!state.gray)
      throw new Error('OpenCV gray mat is not initialized')

    const denoised = new cv.Mat()
    const ksize = new cv.Size(5, 5)
    cv.GaussianBlur(state.gray, denoised, ksize, 0, 0, cv.BORDER_DEFAULT)
    state.denoised = denoised
    return denoised
  }

  /**
   * 检测图像边缘
   * @param options - OpenCV 边缘检测选项，包含 Canny 算法的阈值参数
   * @returns 返回包含检测到的边缘的 Mat 对象
   * @throws 如果 denoised mat 未初始化则抛出错误
   */
  async function detectEdges(options: OpenCVAnalyzeOptions = {}) {
    const cv = await resolveCv()
    if (!state.denoised)
      throw new Error('OpenCV denoised mat is not initialized')

    const mergedOptions = { ...defaultAnalyzeOptions, ...options }
    const edges = new cv.Mat()
    cv.Canny(state.denoised, edges, mergedOptions.cannyThreshold1, mergedOptions.cannyThreshold2)
    state.edges = edges
    return edges
  }

  /**
   * 对边缘检测结果执行形态学操作
   * @description 应用形态学闭运算和膨胀操作来改善边缘检测的结果
   * @returns {Promise<Mat>} 返回形态学处理后的 Mat 对象
   * @throws {Error} 当 OpenCV 边缘检测 Mat 未初始化时抛出错误
   * @remarks
   * - 使用 3x3 的矩形结构元素
   * - 先执行闭运算 (MORPH_CLOSE) 来填充小孔
   * - 再执行膨胀 (dilate) 来扩大白色区域
   * - 自动释放结构元素的内存
   */
  async function morphology() {
    const cv = await resolveCv()
    if (!state.edges)
      throw new Error('OpenCV edges mat is not initialized')

    const morph = new cv.Mat()
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3))
    cv.morphologyEx(state.edges, morph, cv.MORPH_CLOSE, kernel)
    cv.dilate(morph, morph, kernel)
    kernel.delete()
    state.morph = morph
    return morph
  }

  /**
   * 查找图像轮廓
   * @description 使用OpenCV在形态学处理后的图像上查找外轮廓，并返回轮廓和层级信息
   * @returns {Promise<{contours: cv.MatVector, hierarchy: cv.Mat}>} 返回轮廓向量和层级关系矩阵
   * @throws {Error} 当形态学处理矩阵未初始化时抛出错误
   * @async
   */
  async function findContours() {
    const cv = await resolveCv()
    if (!state.morph)
      throw new Error('OpenCV morphology mat is not initialized')

    const contours = new cv.MatVector()
    const hierarchy = new cv.Mat()
    cv.findContours(state.morph, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)
    state.contours = contours
    state.hierarchy = hierarchy
    return { contours, hierarchy }
  }

  /**
   * 过滤轮廓并在图像上绘制边界框
   *
   * 根据指定的过滤选项（最小面积、最小宽高、最大宽高比）对检测到的轮廓进行筛选，
   * 并在源图像上绘制有效轮廓的边界框。同时生成检测结果列表。
   *
   * @param {OpenCVAnalyzeOptions} [options] - 分析选项，包括过滤条件和绘制样式
   * @param {number} [options.minArea] - 轮廓的最小面积阈值
   * @param {number} [options.minWidth] - 轮廓的最小宽度
   * @param {number} [options.minHeight] - 轮廓的最小高度
   * @param {number} [options.maxAspectRatio] - 轮廓的最大宽高比
   * @param {number[]} [options.drawColor] - 边界框的绘制颜色 (BGR)
   * @param {number} [options.drawThickness] - 边界框的线条厚度
   *
   * @returns {Promise<{boxed: Mat, detections: OpenCVDetection[]}>} 返回绘制后的图像矩阵和检测结果数组
   * @returns {Mat} boxed - 绘制了边界框的克隆源图像
   * @returns {OpenCVDetection[]} detections - 通过过滤条件的检测对象数组，包含标签、置信度和边界框信息
   *
   * @throws {Error} 当 OpenCV 源图像或轮廓矩阵未初始化时抛出错误
   */
  async function filterAndDrawBoxes(options: OpenCVAnalyzeOptions = {}) {
    const cv = await resolveCv()
    if (!state.source || !state.contours)
      throw new Error('OpenCV source/contours mat is not initialized')

    const mergedOptions = { ...defaultAnalyzeOptions, ...options }
    const boxed = state.source.clone()
    const detections: OpenCVDetection[] = []

    for (let i = 0; i < state.contours.size(); i += 1) {
      const contour = state.contours.get(i)
      const rect = cv.boundingRect(contour)
      const area = rect.width * rect.height
      const aspectRatio = rect.height > 0 ? rect.width / rect.height : 0
      const isValid = area >= mergedOptions.minArea
        && rect.width >= mergedOptions.minWidth
        && rect.height >= mergedOptions.minHeight
        && aspectRatio <= mergedOptions.maxAspectRatio

      if (isValid) {
        cv.rectangle(
          boxed,
          new cv.Point(rect.x, rect.y),
          new cv.Point(rect.x + rect.width, rect.y + rect.height),
          new cv.Scalar(...mergedOptions.drawColor),
          mergedOptions.drawThickness,
          cv.LINE_AA,
          0,
        )

        detections.push({
          label: 'component',
          confidence: 0.5,
          bbox: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            area,
          },
        })
      }

      contour.delete()
    }

    state.boxed = boxed
    state.detections = detections
    return { boxed, detections }
  }

  /**
   * 导出OpenCV处理结果
   * @async
   * @returns {Promise<OpenCVAnalyzeResult>} 包含检测结果、图像数据和统计信息的对象
   * @returns {Detection[]} detections - 检测到的目标数组
   * @returns {ImageData} imageData - 处理后的图像数据
   * @returns {object} stats - 统计信息对象
   * @returns {number} stats.contourCount - 轮廓数量
   * @returns {number} stats.keptCount - 保留的检测结果数量
   * @returns {number} stats.width - 输出图像宽度（像素）
   * @returns {number} stats.height - 输出图像高度（像素）
   * @throws {Error} 当OpenCV输出矩阵未初始化时抛出错误
   */
  async function exportResult() {
    const cv = await resolveCv()
    const outputMat = state.boxed ?? state.source
    if (!outputMat)
      throw new Error('OpenCV output mat is not initialized')

    const imageData = toImageDataFromMat(cv, outputMat)
    return {
      detections: state.detections,
      imageData,
      stats: {
        contourCount: state.contours?.size?.() ?? 0,
        keptCount: state.detections.length,
        width: outputMat.cols,
        height: outputMat.rows,
      },
    } satisfies OpenCVAnalyzeResult
  }

  /**
   * 分析输入的图像数据
   *
   * 此函数执行完整的图像处理管道，包括读取、灰度转换、降噪、边缘检测、
   * 形态学操作、轮廓检测、过滤绘制边界框，最后导出检测结果。
   *
   * @param input - 输入的图像数据，可以是 ImageData、HTMLCanvasElement 或 HTMLImageElement
   * @param options - OpenCV 分析选项，用于配置边缘检测和过滤绘制框的参数
   * @returns 返回 Promise，解析为处理后的结果对象
   *
   * @remarks
   * - 此函数会自动清理处理过程中的状态
   * - 在 finally 块中会重置检测数据
   * - 确保在异常情况下也能正确释放资源
   */
  async function analyze(input: ImageData | HTMLCanvasElement | HTMLImageElement, options: OpenCVAnalyzeOptions = {}) {
    try {
      await read(input)
      await toGray()
      await denoise()
      await detectEdges(options)
      await morphology()
      await findContours()
      await filterAndDrawBoxes(options)
      return await exportResult()
    }
    finally {
      finalizeState(state)
      state.detections = []
    }
  }

  return { analyze, read, toGray, denoise, detectEdges, morphology, findContours, filterAndDrawBoxes, exportResult }
}
