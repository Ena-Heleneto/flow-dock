<script setup lang="ts">
import type { BatchResult, CookieDiagnostic, RequestMode, SavedImportPipelineConfig } from '../types'

const props = defineProps<{
  savedConfigs: SavedImportPipelineConfig[]
  selectedConfigId: string
  configNameInput: string
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
  'update:selectedConfigId': [value: string]
  'update:configNameInput': [value: string]
  'update:headersText': [value: string]
  'update:fixedParamsText': [value: string]
  'update:dynamicParamsText': [value: string]
  'update:wrapperKey': [value: string]
  'loadConfig': []
  'saveConfig': []
  'createConfig': []
  'deleteConfig': []
}>()

const selectedConfigIdModel = computed({
  get: () => props.selectedConfigId,
  set: value => emit('update:selectedConfigId', value),
})

const configNameInputModel = computed({
  get: () => props.configNameInput,
  set: value => emit('update:configNameInput', value),
})

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
    <div class="mb-3 rounded-lg border border-cyan-200 bg-cyan-50 p-3">
      <h2 class="text-sm font-700 text-cyan-800">
        配置列表
      </h2>
      <select
        v-model="selectedConfigIdModel"
        class="mt-2 w-full rounded border border-cyan-300 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-500"
      >
        <option value="">
          请选择配置
        </option>
        <option v-for="config in savedConfigs" :key="config.id" :value="config.id">
          {{ config.name }}
        </option>
      </select>
      <p class="mt-1 text-[11px] text-cyan-700">
        共 {{ savedConfigs.length }} 条配置
      </p>
      <div class="mt-2 grid grid-cols-2 gap-2">
        <button class="btn !h-8 !rounded-md !px-2 !text-xs" @click="emit('loadConfig')">
          加载所选
        </button>
        <button class="btn !h-8 !rounded-md !bg-slate-700 !px-2 !text-xs hover:!bg-slate-800" @click="emit('saveConfig')">
          覆盖保存
        </button>
      </div>
      <input
        v-model="configNameInputModel"
        class="mt-2 w-full rounded border border-cyan-300 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-500"
        placeholder="输入配置名后新建保存"
        type="text"
      >
      <div class="mt-2 grid grid-cols-2 gap-2">
        <button class="btn !h-8 !rounded-md !bg-cyan-700 !px-2 !text-xs hover:!bg-cyan-800" @click="emit('createConfig')">
          新建保存
        </button>
        <button class="btn !h-8 !rounded-md !bg-rose-700 !px-2 !text-xs hover:!bg-rose-800" @click="emit('deleteConfig')">
          删除所选
        </button>
      </div>
    </div>

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
