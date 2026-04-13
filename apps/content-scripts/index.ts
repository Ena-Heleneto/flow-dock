import { consola } from 'consola'
import './styles/main.css'

const EXTENSION_PROTOCOL_SET = new Set(['chrome-extension:', 'moz-extension:'])

function bootstrapContentScript() {
  if (typeof window === 'undefined')
    return

  if (EXTENSION_PROTOCOL_SET.has(window.location.protocol))
    return

  consola.info(`[${__NAME__}] content script ready`, {
    href: window.location.href,
  })
}

bootstrapContentScript()

export {}
