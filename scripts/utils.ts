import { resolve } from 'node:path'
import process from 'node:process'
import { bgCyan, black } from 'kolorist'

export const port = Number(process.env.PORT || '') || 3303
export const r = (...args: string[]) => resolve(__dirname, '..', ...args)
export const isDev = process.env.NODE_ENV !== 'production'
export const isFirefox = process.env.EXTENSION === 'firefox'
export const extensionDir = process.env.EXTENSION_DIR || 'extension'
export const extensionRoot = r(extensionDir)
export const extensionDistDir = r(extensionDir, 'dist')

export function log(name: string, message: string) {
  console.log(black(bgCyan(` ${name} `)), message)
}
