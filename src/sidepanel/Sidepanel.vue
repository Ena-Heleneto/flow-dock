<script setup lang="ts">
import { storageDemo } from '~/logic/storage'

function openOptionsPage() {
  browser.runtime.openOptionsPage()
}
</script>

<template>
  <main class="w-full px-4 py-5 text-center text-gray-700">
    <Logo />
    <div>Sidepanel</div>
    <SharedSubtitle />

    <div flex="~ col">
      <button class="btn mt-2" @click="openOptionsPage">
        Open Options111
      </button>
      <button class="btn mt-2" @click="openOptionsPage">
        数据库查看器
      </button>
    </div>
    <div m="t-2">
      <span opacity="50">Storage:</span>
      <span>
        {{ storageDemo }}
      </span>
    </div>
  </main>
</template>
