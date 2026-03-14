<script setup lang="ts">
import type { RequestMethod, RequestMode } from '../types'

const props = defineProps<{
  endpoint: string
  method: RequestMethod
  batchSize: number
  autoExtractObjectField: boolean
  requestMode: RequestMode
}>()

const emit = defineEmits<{
  'update:endpoint': [value: string]
  'update:method': [value: RequestMethod]
  'update:batchSize': [value: number]
  'update:autoExtractObjectField': [value: boolean]
  'update:requestMode': [value: RequestMode]
}>()

const endpointModel = computed({
  get: () => props.endpoint,
  set: value => emit('update:endpoint', value),
})

const methodModel = computed({
  get: () => props.method,
  set: value => emit('update:method', value),
})

const batchSizeModel = computed({
  get: () => props.batchSize,
  set: value => emit('update:batchSize', value),
})

const autoExtractModel = computed({
  get: () => props.autoExtractObjectField,
  set: value => emit('update:autoExtractObjectField', value),
})

const requestModeModel = computed({
  get: () => props.requestMode,
  set: value => emit('update:requestMode', value),
})
</script>

<template>
  <div class="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-6">
    <label class="sm:col-span-2 lg:col-span-3">
      <span class="mb-1 block text-xs text-slate-500">后端创建接口</span>
      <input v-model="endpointModel" class="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500" placeholder="https://api.example.com/v1/entity/create" type="text">
    </label>
    <label>
      <span class="mb-1 block text-xs text-slate-500">请求方法</span>
      <select v-model="methodModel" class="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500">
        <option value="POST">
          POST
        </option>
        <option value="PUT">
          PUT
        </option>
      </select>
    </label>
    <label>
      <span class="mb-1 block text-xs text-slate-500">批次大小</span>
      <input v-model.number="batchSizeModel" class="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500" min="1" type="number">
    </label>
    <div class="flex flex-wrap items-end gap-3 pb-1 text-sm sm:col-span-2 lg:col-span-2">
      <label class="inline-flex items-center gap-2">
        <input v-model="autoExtractModel" type="checkbox">
        自动提取 data/items/list
      </label>
      <label class="inline-flex items-center gap-2">
        <input v-model="requestModeModel" type="radio" value="raw-item">
        直接发送对象
      </label>
      <label class="inline-flex items-center gap-2">
        <input v-model="requestModeModel" type="radio" value="wrapped-item">
        包裹对象发送
      </label>
    </div>
  </div>
</template>
