import type { Manifest } from 'webextension-polyfill'
import type PkgType from './package.json'
import { basename, resolve } from 'node:path'
import process from 'node:process'
import fs from 'fs-extra'
import { discoverModules } from './scripts/module-registry'

const port = Number(process.env.PORT || '') || 3303
const r = (...args: string[]) => resolve(__dirname, ...args)

interface SidePanelPageMeta {
  panelPath: string
  title?: string
}

function isDev() {
  return process.env.NODE_ENV !== 'production'
}

function isFirefox() {
  return process.env.EXTENSION === 'firefox'
}

function resolveSidePanelPage(): SidePanelPageMeta | undefined {
  const pageModules = discoverModules({ appsRoot: r('apps') })
    .filter(item => item.kind === 'page')

  if (pageModules.length) {
    const selected = pageModules.find(item => item.manifest?.sidePanelDefault) ?? pageModules[0]

    return {
      panelPath: `${selected.outDir}/${basename(selected.entry)}`,
      title: selected.manifest?.sidebarTitle,
    }
  }

  return undefined
}

export async function getManifest() {
  const pkg = await fs.readJSON(r('package.json')) as typeof PkgType
  const dev = isDev()
  const firefox = isFirefox()
  const geckoId = process.env.FIREFOX_GECKO_ID
  const extensionTitle = pkg.displayName || pkg.name
  const discoveredModules = discoverModules({ appsRoot: r('apps') })
  const hasBackgroundModule = discoveredModules.some(item => item.kind === 'background')
  const hasContentModule = discoveredModules.some(item => item.kind === 'content')
  const sidePanelPage = resolveSidePanelPage()

  // update this file to update this manifest.json
  // can also be conditional based on your need
  const manifest: Manifest.WebExtensionManifest = {
    manifest_version: 3,
    name: extensionTitle,
    version: pkg.version,
    description: pkg.description,
    action: {
      // default_icon: 'assets/icon-512.png',
      default_title: extensionTitle,
    },
    ...(hasBackgroundModule
      ? {
          background: firefox
            ? { scripts: ['background/index.mjs'], type: 'module' }
            : { service_worker: 'background/index.mjs' },
        }
      : {}),
    icons: { },
    permissions: firefox
      ? ['tabs', 'storage', 'activeTab']
      : ['tabs', 'storage', 'activeTab', 'sidePanel'] as Manifest.Permission[],
    host_permissions: ['*://*/*'],
    ...(hasContentModule
      ? {
          content_scripts: [
            {
              matches: ['<all_urls>'],
              js: ['content-scripts/index.global.js'],
            },
          ],
        }
      : {}),
    content_security_policy: {
      extension_pages: dev
        // this is required on dev for Vite script to load
        ? `script-src \'self\' http://localhost:${port}; object-src \'self\'`
        : 'script-src \'self\'; object-src \'self\'',
    },
  }

  if (firefox && sidePanelPage) {
    manifest.sidebar_action = {
      default_title: sidePanelPage.title ?? extensionTitle,
      default_panel: sidePanelPage.panelPath,
    }
  }
  else if (sidePanelPage) {
    (manifest as Manifest.WebExtensionManifest & {
      side_panel?: { default_path: string }
    }).side_panel = {
      default_path: sidePanelPage.panelPath,
    }
  }

  if (firefox && geckoId) {
    manifest.browser_specific_settings = {
      gecko: { id: geckoId },
    }
  }

  return manifest
}

async function writeManifestFromEnv() {
  const outFile = process.env.MANIFEST_OUT
  if (!outFile)
    return

  await fs.outputJSON(outFile, await getManifest(), { spaces: 2 })
}

void writeManifestFromEnv()
