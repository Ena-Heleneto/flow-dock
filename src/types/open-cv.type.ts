export interface OpenCVBBox {
  x: number
  y: number
  width: number
  height: number
  area: number
}

export interface OpenCVDetection {
  label: string
  confidence: number
  bbox: OpenCVBBox
}

export interface OpenCVAnalyzeOptions {
  cannyThreshold1?: number
  cannyThreshold2?: number
  minArea?: number
  minWidth?: number
  minHeight?: number
  maxAspectRatio?: number
  drawColor?: [number, number, number, number]
  drawThickness?: number
}

export interface OpenCVAnalyzeResult {
  detections: OpenCVDetection[]
  imageData: ImageData
  stats: {
    contourCount: number
    keptCount: number
    width: number
    height: number
  }
}

export interface OpenCVState {
  source: any
  gray: any
  denoised: any
  edges: any
  morph: any
  contours: any
  hierarchy: any
  boxed: any
  detections: OpenCVDetection[]
}
