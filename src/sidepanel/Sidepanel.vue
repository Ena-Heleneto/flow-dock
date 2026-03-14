<script setup lang="ts">
async function openExtensionPage(path: string) {
  const url = browser.runtime.getURL(path)

  try {
    await browser.tabs.create({ url })
  }
  catch {
    const chromeTabs = (globalThis as any).chrome?.tabs
    if (chromeTabs?.create)
      chromeTabs.create({ url })
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

    if (chromeRuntime?.openOptionsPage)
      chromeRuntime.openOptionsPage()
    else
      await openExtensionPage('dist/database/index.html')
  }
}

async function openGlobalSettingsPage() {
  await openExtensionPage('dist/options/index.html')
}

async function openImportPipelinePage() {
  await openExtensionPage('dist/import-pipeline/index.html')
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
    </div>
  </main>
</template>
