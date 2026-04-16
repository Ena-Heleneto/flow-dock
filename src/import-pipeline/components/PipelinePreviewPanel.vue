<script setup lang="ts">
const props = defineProps<{
  previewIndex: number
  parsedCount: number
  mergedPreviewError: string
  mergedPreviewText: string
}>()

const emit = defineEmits<{ 'update:previewIndex': [value: number] }>()

const previewIndexModel = computed({
  get: () => props.previewIndex,
  set: value => emit('update:previewIndex', value),
})
</script>

<template>
  <article class="rounded-xl border border-slate-200 bg-white p-4 md:col-span-2">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h3 class="text-sm font-700 text-slate-800">
        参数合并结果预览
      </h3>
      <label class="inline-flex items-center gap-2 text-xs text-slate-600">
        预览第
        <input
          v-model.number="previewIndexModel"
          class="w-18 rounded border border-slate-300 px-2 py-1 text-right text-xs outline-none focus:border-teal-500"
          :max="Math.max(parsedCount - 1, 0)"
          min="0"
          type="number"
        >
        条（从 0 开始）
      </label>
    </div>

    <p v-if="mergedPreviewError" class="mt-2 text-xs text-rose-600">
      {{ mergedPreviewError }}
    </p>

    <pre v-else class="mt-2 max-h-64 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] leading-4 text-slate-700">{{ mergedPreviewText }}</pre>
  </article>
</template>
