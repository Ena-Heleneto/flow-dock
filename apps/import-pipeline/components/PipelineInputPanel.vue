<script setup lang="ts">
const props = defineProps<{
  inputText: string
  parseError: string
  isImporting: boolean
  previewItems: Record<string, unknown>[]
}>()

const emit = defineEmits<{
  'update:inputText': [value: string]
  'parseInput': []
  'fileChange': [event: Event]
}>()

const inputTextModel = computed({
  get: () => props.inputText,
  set: value => emit('update:inputText', value),
})
</script>

<template>
  <article class="relative rounded-xl border border-slate-200 bg-white p-4">
    <h3 class="text-sm font-700 text-slate-800">
      输入数据
    </h3>
    <textarea
      v-model="inputTextModel"
      class="mt-2 h-52 w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs outline-none focus:border-teal-500"
      placeholder="粘贴对象数组 JSON，或通过下方按钮导入 JSON / Excel"
      spellcheck="false"
      :disabled="isImporting"
    />

    <div class="mt-3 flex flex-wrap items-center gap-2">
      <button class="btn" :disabled="isImporting" @click="emit('parseInput')">
        {{ isImporting ? '解析中...' : '解析输入' }}
      </button>
      <label class="btn bg-slate-700 hover:bg-slate-800" :class="isImporting ? 'pointer-events-none opacity-60' : ''">
        {{ isImporting ? '导入中...' : '导入 JSON / Excel' }}
        <input class="hidden" type="file" accept="application/json,.json,text/plain,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" :disabled="isImporting" @change="emit('fileChange', $event)">
      </label>
    </div>

    <p v-if="isImporting" class="mt-2 text-xs text-teal-600">
      正在解析文件，请稍候...
    </p>

    <p v-if="parseError" class="mt-2 text-xs text-rose-600">
      解析错误：{{ parseError }}
    </p>

    <div class="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2">
      <p class="text-xs text-slate-500">
        预览前 {{ previewItems.length }} 条
      </p>
      <pre class="mt-1 overflow-auto text-[11px] leading-4 text-slate-700">{{ JSON.stringify(previewItems, null, 2) }}</pre>
    </div>

    <div
      v-if="isImporting"
      class="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/75 backdrop-blur-[1px]"
    >
      <div class="flex items-center gap-2 rounded-full border border-teal-200 bg-white px-3 py-2 text-xs text-teal-700 shadow">
        <span class="h-3 w-3 animate-spin rounded-full border-2 border-teal-500 border-r-transparent" />
        <span>正在解析文件...</span>
      </div>
    </div>
  </article>
</template>
