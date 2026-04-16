export interface PageMetrics {
  scrollX: number
  scrollY: number
  viewportWidth: number
  viewportHeight: number
  scrollWidth: number
  scrollHeight: number
  devicePixelRatio: number
  scrollMode: 'window' | 'element'
  targetViewportTop: number
  targetViewportLeft: number
  targetViewportWidth: number
  targetViewportHeight: number
  pageViewportWidth: number
  pageViewportHeight: number
  maxScrollY: number
}

export interface CapturedSlice {
  scrollY: number
  capture: Awaited<ReturnType<typeof captureVisibleTab>>
}
