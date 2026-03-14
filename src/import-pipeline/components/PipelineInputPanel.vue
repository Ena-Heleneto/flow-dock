<script setup lang="ts">
const props = defineProps<{
  inputText: string
  parseError: string
  previewItems: Record<string, unknown>[]
}>()

const emit = defineEmits<{
  'update:inputText': [value: string]
  'parse-input': []
  'file-change': [event: Event]
}>()

const inputTextModel = computed({
  get: () => props.inputText,
  set: value => emit('update:inputText', value),
})
</script>

<template>
  <article class="rounded-xl border border-slate-200 bg-white p-4">
    <h3 class="text-sm font-700 text-slate-800">
      输入数据
    </h3>
    <textarea
      v-model="inputTextModel"
      class="mt-2 h-52 w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs outline-none focus:border-teal-500"
      placeholder="粘贴对象数组 JSON"
      spellcheck="false"
    />

    <div class="mt-3 flex flex-wrap items-center gap-2">
      <button class="btn" @click="emit('parse-input')">
        解析输入
      </button>
      <label class="btn bg-slate-700 hover:bg-slate-800">
        导入 JSON 文件
        <input class="hidden" type="file" accept="application/json,.json,text/plain" @change="emit('file-change', $event)">
      </label>
    </div>

    <p v-if="parseError" class="mt-2 text-xs text-rose-600">
      解析错误：{{ parseError }}
    </p>

    <div class="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2">
      <p class="text-xs text-slate-500">
        预览前 {{ previewItems.length }} 条
      </p>
      <pre class="mt-1 overflow-auto text-[11px] leading-4 text-slate-700">{{ JSON.stringify(previewItems, null, 2) }}</pre>
    </div>
  </article>
</template>
