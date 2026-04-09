import { consola } from 'consola'
import browser from 'webextension-polyfill'
import './router-dispatcher'

interface ChromeSidePanelApi {
  open?: (options: { tabId?: number, windowId?: number }) => Promise<void> | void
  setPanelBehavior?: (options: { openPanelOnActionClick: boolean }) => Promise<void> | void
}

interface FirefoxSidebarActionApi {
  open?: () => Promise<void> | void
}

function getChromeSidePanelApi(): ChromeSidePanelApi | undefined {
  return (globalThis as {
    chrome?: {
      sidePanel?: ChromeSidePanelApi
    }
  }).chrome?.sidePanel
}

function getFirefoxSidebarActionApi(): FirefoxSidebarActionApi | undefined {
  return (browser as unknown as {
    sidebarAction?: FirefoxSidebarActionApi
  }).sidebarAction
}

async function openNavigationTab() {
  const url = browser.runtime.getURL('navigation/index.html')
  await browser.tabs.create({ url })
}

async function openDrawerForToolbarAction(tab?: browser.Tabs.Tab) {
  const firefoxSidebarAction = getFirefoxSidebarActionApi()
  if (firefoxSidebarAction?.open) {
    try {
      await firefoxSidebarAction.open()
      return
    }
    catch (error) {
      consola.warn(`[${__NAME__}] failed to open Firefox sidebar`, error)
    }
  }

  const chromeSidePanel = getChromeSidePanelApi()
  if (chromeSidePanel?.open) {
    try {
      if (typeof tab?.id === 'number') {
        await chromeSidePanel.open({ tabId: tab.id })
        return
      }

      if (typeof tab?.windowId === 'number') {
        await chromeSidePanel.open({ windowId: tab.windowId })
        return
      }
    }
    catch (error) {
      consola.warn(`[${__NAME__}] failed to open Chrome side panel`, error)
    }
  }

  await openNavigationTab()
}

async function setupToolbarOpenBehavior() {
  const chromeSidePanel = getChromeSidePanelApi()
  if (!chromeSidePanel?.setPanelBehavior)
    return

  try {
    await chromeSidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  }
  catch (error) {
    consola.warn(`[${__NAME__}] failed to configure side panel action behavior`, error)
  }
}

browser.runtime.onInstalled.addListener((): void => {
  consola.log(`[${__NAME__}] extension installed`)
  void setupToolbarOpenBehavior()
})

browser.runtime.onStartup.addListener((): void => {
  void setupToolbarOpenBehavior()
})

browser.action.onClicked.addListener((tab): void => {
  void openDrawerForToolbarAction(tab)
})

export {}
