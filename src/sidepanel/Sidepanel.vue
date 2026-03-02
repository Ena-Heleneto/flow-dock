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
</script>

<template>
  <main class="w-full px-4 py-5 text-center text-gray-700">
    <Logo />
    <!-- <div>Sidepanel</div> -->

    <div flex="~ col">
      <button class="btn mt-2" @click="openGlobalSettingsPage">
        全局设置
      </button>
      <button class="btn mt-2" @click="openOptionsPage">
        数据库查看器
      </button>
    </div>
  </main>
</template>
