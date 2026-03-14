<script setup lang="ts">
defineProps<{
  logs: string[]
}>()
</script>

<template>
  <article class="rounded-xl border border-slate-200 bg-slate-900 p-4 text-slate-100">
    <h3 class="text-sm font-700">
      执行日志
    </h3>

    <div class="mt-2 h-52 overflow-auto rounded bg-black/25 p-2 font-mono text-xs leading-5">
      <p v-for="line in logs" :key="line" class="whitespace-pre-wrap break-all">
        {{ line }}
      </p>
    </div>
  </article>
</template>
