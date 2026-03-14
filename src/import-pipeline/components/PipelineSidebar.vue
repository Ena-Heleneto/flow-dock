<script setup lang="ts">
import type { BatchResult, CookieDiagnostic, RequestMode } from '../types'

const props = defineProps<{
  headersText: string
  fixedParamsText: string
  dynamicParamsText: string
  requestMode: RequestMode
  wrapperKey: string
  cookieDiagnostic: CookieDiagnostic
  result: BatchResult
  runningBatch: number
  totalBatch: number
}>()

const emit = defineEmits<{
  'update:headersText': [value: string]
  'update:fixedParamsText': [value: string]
  'update:dynamicParamsText': [value: string]
  'update:wrapperKey': [value: string]
}>()

const headersTextModel = computed({
  get: () => props.headersText,
  set: value => emit('update:headersText', value),
})

const fixedParamsTextModel = computed({
  get: () => props.fixedParamsText,
  set: value => emit('update:fixedParamsText', value),
})

const dynamicParamsTextModel = computed({
  get: () => props.dynamicParamsText,
  set: value => emit('update:dynamicParamsText', value),
})

const wrapperKeyModel = computed({
  get: () => props.wrapperKey,
  set: value => emit('update:wrapperKey', value),
})
</script>

<template>
  <aside class="rounded-xl border border-slate-200 bg-slate-50 p-3">
    <div class="mb-3">
      <h2 class="text-sm font-600 text-slate-800">
        请求头 JSON
      </h2>
      <textarea
        v-model="headersTextModel"
        class="mt-2 h-30 w-full rounded border border-slate-300 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-teal-500"
        spellcheck="false"
      />
      <div class="mt-2 rounded-lg border p-2 text-[11px]" :class="cookieDiagnostic.toneClass">
        <p class="font-700">
          {{ cookieDiagnostic.title }}
        </p>
        <p v-for="(message, index) in cookieDiagnostic.messages" :key="`${index}-${message}`" class="mt-1 leading-4">
          {{ message }}
        </p>
      </div>
    </div>

    <div class="mb-3">
      <h2 class="text-sm font-600 text-slate-800">
        参数构建：固定参数
      </h2>
      <textarea
        v-model="fixedParamsTextModel"
        class="mt-2 h-28 w-full rounded border border-slate-300 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-teal-500"
        spellcheck="false"
      />
    </div>

    <div class="mb-3">
      <h2 class="text-sm font-600 text-slate-800">
        参数构建：动态替换参数
      </h2>
      <textarea
        v-model="dynamicParamsTextModel"
        class="mt-2 h-32 w-full rounded border border-slate-300 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-teal-500"
        spellcheck="false"
      />
      <p v-pre class="mt-1 text-[11px] text-slate-500">
        支持占位符：{{ code }}、{{ item.name }}、{{ index }}（从0开始）、{{ index1 }}（从1开始）
      </p>
    </div>

    <div v-if="requestMode === 'wrapped-item'" class="mb-3">
      <h2 class="text-sm font-600 text-slate-800">
        包裹字段名
      </h2>
      <input
        v-model="wrapperKeyModel"
        class="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
        placeholder="data"
        type="text"
      >
    </div>

    <div class="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
      <p>总记录：{{ result.total }}</p>
      <p class="mt-1">
        成功：{{ result.success }}
      </p>
      <p class="mt-1">
        失败：{{ result.failed }}
      </p>
      <p class="mt-1">
        批次：{{ runningBatch }} / {{ totalBatch }}
      </p>
    </div>
  </aside>
</template>
