import browser from 'webextension-polyfill'

browser.runtime.onInstalled.addListener((): void => {
  // eslint-disable-next-line no-console
  console.log('[flow-dock] extension installed (empty shell)')
})

export {}
