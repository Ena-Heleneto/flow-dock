// generate stub index.html files for dev entry
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import fs from 'fs-extra'
import chokidar from 'chokidar'
import { extensionDir, extensionDistDir, isDev, log, port, r } from './utils'

function shouldStubIndexHtml() {
  const normalizedExtensionDir = extensionDir.replace(/\\/g, '/')
  return isDev && normalizedExtensionDir.startsWith('dist/dev/')
}

/**
 * Stub index.html to use Vite in development
 */
async function stubIndexHtml() {
  const views = ['database', 'dict-keeper', 'import-pipeline', 'options', 'popup', 'sidepanel']

  for (const view of views) {
    const viewDistDir = join(extensionDistDir, view)
    await fs.ensureDir(viewDistDir)
    let data = await fs.readFile(r(`src/${view}/index.html`), 'utf-8')
    data = data
      .replace('"./main.ts"', `"http://localhost:${port}/${view}/main.ts"`)
      .replace('<div id="app"></div>', '<div id="app">Vite server did not start</div>')
    await fs.writeFile(join(viewDistDir, 'index.html'), data, 'utf-8')
    log('PRE', `stub ${view}`)
  }
}

function writeManifest() {
  execSync('npx esno ./scripts/manifest.ts', { stdio: 'inherit' })
}

writeManifest()

if (shouldStubIndexHtml()) {
  stubIndexHtml()
  chokidar.watch(r('src/**/*.html'))
    .on('change', () => {
      stubIndexHtml()
    })
  chokidar.watch([r('src/manifest.ts'), r('package.json')])
    .on('change', () => {
      writeManifest()
    })
}
