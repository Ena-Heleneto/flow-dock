export interface PageMetrics {
  scrollX: number
  scrollY: number
  viewportWidth: number
  viewportHeight: number
  scrollWidth: number
  scrollHeight: number
  devicePixelRatio: number
}

export interface CapturedSlice {
  scrollY: number
  capture: Awaited<ReturnType<typeof captureVisibleTab>>
}
