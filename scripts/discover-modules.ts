import type { ModuleKind } from './module-registry'
import process from 'node:process'
import { discoverModules } from './module-registry'

function parseArgs() {
  const result: {
    kind?: ModuleKind
    format: 'lines' | 'json'
  } = {
    format: 'lines',
  }

  const args = process.argv.slice(2)
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--kind') {
      const value = args[i + 1] as ModuleKind | undefined
      if (value)
        result.kind = value
      i++
      continue
    }

    if (arg === '--format') {
      const value = args[i + 1]
      if (value === 'json' || value === 'lines')
        result.format = value
      i++
      continue
    }
  }

  return result
}

function main() {
  const args = parseArgs()
  const modules = discoverModules()
  const filtered = args.kind ? modules.filter(item => item.kind === args.kind) : modules

  if (args.format === 'json') {
    process.stdout.write(`${JSON.stringify(filtered, null, 2)}\n`)
    return
  }

  for (const item of filtered)
    process.stdout.write(`${item.dirName}\n`)
}

main()
