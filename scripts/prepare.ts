// generate extension manifest
import { execSync } from 'node:child_process'
import chokidar from 'chokidar'
import { isDev, r } from './context'

function writeManifest() {
  execSync('npx esno ./scripts/manifest.ts', { stdio: 'inherit' })
}

writeManifest()

if (isDev) {
  chokidar.watch([r('manifest.ts'), r('package.json')])
    .on('change', () => writeManifest())
}
