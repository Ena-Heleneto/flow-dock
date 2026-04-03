<script setup lang="ts">
async function openExtensionPage(path: string) {
  const url = browser.runtime.getURL(path)
  const chromeTabs = (globalThis as any).chrome?.tabs

  try {
    await browser.tabs.create({ url })
  }
  catch {
    if (chromeTabs?.create)
      chromeTabs.create({ url })
    else
      await browser.tabs.create({ url })
  }
}

/**
 * 打开扩展的选项页面。
 * 首先尝试使用 `browser.runtime.openOptionsPage()` 方法，
 * 如果失败，则兼容 Chrome 扩展的 `chrome.runtime.openOptionsPage()` 方法。
 * 如果仍然无法打开，则回退到打开指定的扩展页面（如数据库页面）。
 *
 * @async
 * @returns {Promise<void>} 无返回值，异步执行打开页面操作。
 */
async function openOptionsPage() {
  try {
    await browser.runtime.openOptionsPage()
  }
  catch {
    const chromeRuntime = (globalThis as any).chrome?.runtime
    const chromeTabs = (globalThis as any).chrome?.tabs
    const optionsUrl = browser.runtime.getURL('dist/database/index.html')

    if (chromeRuntime?.openOptionsPage)
      chromeRuntime.openOptionsPage()
    else if (chromeTabs?.create)
      chromeTabs.create({ url: optionsUrl })
    else
      await browser.tabs.create({ url: optionsUrl })
  }
}

async function openGlobalSettingsPage() {
  await openExtensionPage('dist/options/index.html')
}

async function openImportPipelinePage() {
  await openExtensionPage('dist/import-pipeline/index.html')
}

async function openDictKeeperPage() {
  await openExtensionPage('dist/dict-keeper/index.html')
}
</script>

<template>
  <main class="w-full px-4 py-5 text-center text-gray-700">
    <Logo />

    <div flex="~ col">
      <button class="btn mt-2" @click="openGlobalSettingsPage">
        全局设置
      </button>
      <button class="btn mt-2" @click="openOptionsPage">
        数据库查看器
      </button>
      <button class="btn mt-2" @click="openImportPipelinePage">
        数据导入流水线
      </button>
      <button class="btn mt-2" @click="openDictKeeperPage">
        数据字典管理器
      </button>
    </div>
  </main>
</template>
