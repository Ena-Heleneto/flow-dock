export async function ensureOffscreen() {
  const offscreen = (globalThis as {
    chrome?: {
      offscreen?: {
        hasDocument?: () => Promise<boolean>
        createDocument: (options: { url: string, reasons: string[], justification: string }) => Promise<void>
      }
    }
  }).chrome?.offscreen

  if (!offscreen)
    return false

  const exists = await offscreen.hasDocument?.().catch(() => false)
  if (exists)
    return true

  const runtimeGetURL = browser?.runtime?.getURL
  const offscreenUrl = typeof runtimeGetURL === 'function'
    ? runtimeGetURL('dist/offscreen/index.html')
    : 'dist/offscreen/index.html'

  try {
    await offscreen.createDocument({
      url: offscreenUrl,
      reasons: ['BLOBS'],
      justification: 'Need canvas to stitch screenshots',
    })
    return true
  }
  catch {
    return false
  }
}
