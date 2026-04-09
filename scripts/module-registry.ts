import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

export type ModuleKind = 'page' | 'background' | 'content'

export interface ModuleManifestConfig {
  sidePanelDefault?: boolean
  sidebarTitle?: string
}

export interface ModuleConfig {
  id?: string
  kind?: ModuleKind
  enabled?: boolean
  manifest?: ModuleManifestConfig
  background?: {
    entry?: string
    outDir?: string
  }
  content?: {
    entry?: string
    outDir?: string
  }
  page?: {
    entry?: string
    outDir?: string
  }
}

export interface DiscoveredModule {
  id: string
  dirName: string
  kind: ModuleKind
  entry: string
  outDir: string
  manifest?: ModuleManifestConfig
}

interface DiscoverModulesOptions {
  appsRoot?: string
}

function readModuleConfig(dirPath: string): ModuleConfig {
  const configPath = resolve(dirPath, 'module.config.json')
  if (!existsSync(configPath))
    return {}

  try {
    return JSON.parse(readFileSync(configPath, 'utf8')) as ModuleConfig
  }
  catch (error) {
    throw new Error(`[module-registry] invalid JSON: ${configPath}\n${String(error)}`)
  }
}

function inferKind(dirName: string, dirPath: string, config: ModuleConfig): ModuleKind | undefined {
  if (config.kind)
    return config.kind

  if (dirName === 'background')
    return 'background'

  if (dirName === 'content-scripts')
    return 'content'

  if (existsSync(resolve(dirPath, 'index.html')))
    return 'page'

  return undefined
}

function resolveEntry(kind: ModuleKind, config: ModuleConfig): string {
  if (kind === 'background')
    return config.background?.entry ?? 'main.ts'

  if (kind === 'content')
    return config.content?.entry ?? 'index.ts'

  return config.page?.entry ?? 'index.html'
}

function resolveOutDir(kind: ModuleKind, dirName: string, config: ModuleConfig): string {
  if (kind === 'background')
    return config.background?.outDir ?? 'background'

  if (kind === 'content')
    return config.content?.outDir ?? 'content-scripts'

  return config.page?.outDir ?? dirName
}

export function discoverModules(options: DiscoverModulesOptions = {}): DiscoveredModule[] {
  const appsRoot = options.appsRoot ?? resolve(__dirname, '..', 'apps')
  if (!existsSync(appsRoot))
    return []

  const dirNames = readdirSync(appsRoot)
    .filter(dirName => !dirName.startsWith('.'))
    .sort((a, b) => a.localeCompare(b))

  const modules: DiscoveredModule[] = []

  for (const dirName of dirNames) {
    const dirPath = resolve(appsRoot, dirName)
    const stat = statSync(dirPath)
    if (!stat.isDirectory())
      continue

    const config = readModuleConfig(dirPath)
    if (config.enabled === false)
      continue

    const kind = inferKind(dirName, dirPath, config)
    if (!kind)
      continue

    const entry = resolveEntry(kind, config)
    const entryPath = resolve(dirPath, entry)
    if (!existsSync(entryPath))
      continue

    modules.push({
      id: config.id ?? dirName,
      dirName,
      kind,
      entry,
      outDir: resolveOutDir(kind, dirName, config),
      manifest: config.manifest,
    })
  }

  return modules
}
