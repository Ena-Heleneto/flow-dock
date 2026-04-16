import { onMessage } from 'webext-bridge/content-script'
import { createApp } from 'vue'
import App from './views/App.vue'
import contentScriptStyles from './content-script.css?raw'
import { setupApp } from '~/logic/common-setup'

function createOverlayHost() {
  const host = document.createElement('div')
  host.id = __NAME__
  host.setAttribute('data-flow-dock-overlay', 'true')
  return host
}

function mountOverlayApp() {
  const host = createOverlayHost()
  const shadowRoot = host.attachShadow({ mode: __DEV__ ? 'open' : 'closed' })
  const style = document.createElement('style')
  style.textContent = contentScriptStyles

  const root = document.createElement('div')
  root.id = 'app'

  shadowRoot.append(style, root)
  ;(document.body ?? document.documentElement).appendChild(host)

  const app = createApp(App)
  setupApp(app)
  app.mount(root)
}

(() => {
  // console.info('[vitesse-webext] Hello world from content script')

  // communication example: send previous tab title from background page
  onMessage('tab-prev', ({ data: _data }: { data: { title: string } }) => {
    // console.log(`[vitesse-webext] Navigate from page "${data.title}"`)
  })

  mountOverlayApp()
})()
