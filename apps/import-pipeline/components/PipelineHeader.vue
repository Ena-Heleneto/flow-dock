<script setup lang="ts">
import type { RunStatus } from '../types'

defineProps<{ canRun: boolean, runStatus: RunStatus, statusTone: string, statusText: string }>()

const emit = defineEmits<{ run: [], stop: [], reset: [] }>()
</script>

<template>
  <header class="mb-5 flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-center md:justify-between">
    <div>
      <h1 class="text-2xl font-700 tracking-tight text-slate-900">
        批量创建工作台1
      </h1>
      <p class="mt-1 text-sm text-slate-600">
        读取对象数组或 JSON，按批次调用后端接口，实现批量创建数据。
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <button class="btn" :disabled="!canRun" @click="emit('run')">
        开始执行
      </button>
      <button class="btn bg-amber-600 hover:bg-amber-700" :disabled="runStatus !== 'running'" @click="emit('stop')">
        停止
      </button>
      <button class="btn bg-slate-700 hover:bg-slate-800" @click="emit('reset')">
        重置
      </button>
      <span class="rounded-full px-3 py-1 text-xs" :class="statusTone">{{ statusText }}</span>
    </div>
  </header>
</template>
