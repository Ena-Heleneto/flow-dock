<script setup lang="ts">
import { storageDemo } from '~/logic/storage'

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
      browser.tabs.create({ url: optionsUrl })
  }
}
</script>

<template>
  <main class="w-[300px] px-4 py-5 text-center text-gray-700">
    <Logo />
    <div>Popup</div>
    <SharedSubtitle />

    <button class="btn mt-2" @click="openOptionsPage">
      Open Options
    </button>
    <div class="mt-2">
      <span class="opacity-50">Storage:</span> {{ storageDemo }}
    </div>
  </main>
</template>
