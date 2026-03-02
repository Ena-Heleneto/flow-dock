<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { KvConfigsService, isAbsoluteScreenshotCachePath } from '~/background/services/kv_configs.services'

const form = reactive({
  workspaceName: '',
  apiBaseUrl: '',
  enableDebugMode: false,
  screenshotCachePath: '',
})

const submitMessage = ref('')
const loading = ref(false)
const kvConfigsService = new KvConfigsService()

async function loadSettings() {
  loading.value = true
  try {
    const settings = await kvConfigsService.getGlobalSettings()
    form.workspaceName = settings.workspaceName
    form.apiBaseUrl = settings.apiBaseUrl
    form.enableDebugMode = settings.enableDebugMode
    form.screenshotCachePath = settings.screenshotCachePath
  }
  finally {
    loading.value = false
  }
}

async function handleSubmit() {
  if (isAbsoluteScreenshotCachePath(form.screenshotCachePath)) {
    submitMessage.value = '不支持填写本地绝对路径，请填写“下载目录”下的相对路径，例如：flow-dock/screenshots'
    return
  }

  loading.value = true
  try {
    const saved = await kvConfigsService.saveGlobalSettings({
      workspaceName: form.workspaceName,
      apiBaseUrl: form.apiBaseUrl,
      enableDebugMode: form.enableDebugMode,
      screenshotCachePath: form.screenshotCachePath,
    })

    form.workspaceName = saved.workspaceName
    form.apiBaseUrl = saved.apiBaseUrl
    form.enableDebugMode = saved.enableDebugMode
    form.screenshotCachePath = saved.screenshotCachePath
    submitMessage.value = '配置已保存到数据库'
  }
  catch (error) {
    submitMessage.value = `保存失败：${error instanceof Error ? error.message : String(error)}`
  }
  finally {
    loading.value = false
  }
}

async function handleReset() {
  submitMessage.value = ''
  await loadSettings()
}

onMounted(async () => {
  await loadSettings()
})
</script>

<template>
  <main class="mx-auto max-w-lg px-4 py-5 text-gray-700">
    <h1 class="text-lg font-bold">
      全局设置
    </h1>

    <form class="mt-4 flex flex-col gap-3" @submit.prevent="handleSubmit">
      <label class="flex flex-col gap-1">
        <span>工作区名称</span>
        <input v-model="form.workspaceName" type="text" placeholder="请输入名称">
      </label>

      <label class="flex flex-col gap-1">
        <span>API 地址</span>
        <input v-model="form.apiBaseUrl" type="url" placeholder="https://example.com/api">
      </label>

      <label class="flex items-center gap-2">
        <input v-model="form.enableDebugMode" type="checkbox">
        <span>启用调试模式</span>
      </label>

      <label class="flex flex-col gap-1">
        <span>截图缓存位置（相对下载目录）</span>
        <input v-model="form.screenshotCachePath" type="text" placeholder="flow-dock/screenshots">
        <span class="text-xs opacity-70">示例：flow-dock/screenshots（不支持 /home/... 或 C:\\... 绝对路径）</span>
      </label>

      <div class="mt-2 flex gap-2">
        <button class="btn" :disabled="loading" type="submit">
          {{ loading ? '保存中...' : '提交' }}
        </button>
        <button class="btn" :disabled="loading" type="button" @click="handleReset">
          还原
        </button>
      </div>
    </form>

    <p v-if="submitMessage" class="mt-3">
      {{ submitMessage }}
    </p>
  </main>
</template>
