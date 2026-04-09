<script setup lang="ts">
import { request } from '~/shared/composables/useRouterRequest'

const keyInput = ref('demo')
const valueInput = ref('hello world')
const responseText = ref('')
const loading = ref(false)

async function handleInsert() {
  loading.value = true
  try {
    const response = await request('/database-manger/insert', {
      method: 'POST',
      body: {
        key: keyInput.value,
        value: {
          text: valueInput.value,
        },
      },
      meta: {
        module: 'database-manger',
        page: 'database-manger',
      },
    })

    responseText.value = JSON.stringify(response, null, 2)
  }
  finally {
    loading.value = false
  }
}

async function handleRead() {
  loading.value = true
  try {
    const response = await request('/database-manger/read', {
      method: 'GET',
      body: {
        key: keyInput.value,
      },
      meta: {
        module: 'database-manger',
        page: 'database-manger',
      },
    })

    responseText.value = JSON.stringify(response, null, 2)
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="mx-auto w-full max-w-3xl p-4 text-slate-800">
    <h1 class="text-lg font-semibold">
      Database Manager Router Demo
    </h1>

    <p class="mt-2 text-sm text-slate-500">
      页面调用 <code>request('/database-manger/*')</code>，后台按文件路径路由并注入 event.context。
    </p>

    <section class="mt-4 grid gap-3 rounded border border-slate-200 bg-white p-3">
      <label class="grid gap-1 text-sm">
        <span class="font-medium">Key</span>
        <input v-model="keyInput" class="rounded border border-slate-300 px-2 py-1" type="text">
      </label>

      <label class="grid gap-1 text-sm">
        <span class="font-medium">Value (text)</span>
        <input v-model="valueInput" class="rounded border border-slate-300 px-2 py-1" type="text">
      </label>

      <div class="flex gap-2">
        <button
          class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="loading"
          type="button"
          @click="handleInsert"
        >
          Insert
        </button>
        <button
          class="rounded bg-slate-700 px-3 py-1.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="loading"
          type="button"
          @click="handleRead"
        >
          Read
        </button>
      </div>
    </section>

    <section class="mt-4 rounded border border-slate-200 bg-slate-50 p-3">
      <h2 class="mb-2 text-sm font-semibold text-slate-600">
        Response
      </h2>
      <pre class="max-h-80 overflow-auto text-xs leading-5">{{ responseText || '暂无返回，先点一个按钮试试。' }}</pre>
    </section>
  </main>
</template>
