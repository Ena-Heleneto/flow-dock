import type { Manifest } from 'webextension-polyfill'
import type PkgType from './package.json'
import fs from 'fs-extra'
import { isDev, isFirefox, port, r } from './scripts/context'

export async function getManifest() {
  const pkg = await fs.readJSON(r('package.json')) as typeof PkgType

  // update this file to update this manifest.json
  // can also be conditional based on your need
  const manifest: Manifest.WebExtensionManifest = {
    manifest_version: 3,
    name: pkg.displayName || pkg.name,
    version: pkg.version,
    description: pkg.description,
    action: {
      // default_icon: 'assets/icon-512.png',
    },
    background: isFirefox
      ? { scripts: ['dist/server/index.mjs'], type: 'module' }
      : { service_worker: 'dist/server/index.mjs' },
    icons: { },
    permissions: ['tabs', 'storage', 'activeTab'],
    host_permissions: ['*://*/*'],
    content_scripts: [
      {
        matches: ['<all_urls>'],
        js: ['dist/contentScripts/index.global.js'],
      },
    ],
    content_security_policy: {
      extension_pages: isDev
        // this is required on dev for Vite script to load
        ? `script-src \'self\' http://localhost:${port}; object-src \'self\'`
        : 'script-src \'self\'; object-src \'self\'',
    },
  }

  return manifest
}
