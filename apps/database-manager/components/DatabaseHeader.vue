<script setup lang="ts">
import type { DatabaseLayoutMode } from '../composables/useDatabaseManagerState'

interface Props {
  layoutMode: DatabaseLayoutMode
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:layoutMode', mode: DatabaseLayoutMode): void
}>()

function setLayoutMode(mode: DatabaseLayoutMode) {
  emit('update:layoutMode', mode)
}
</script>

<template>
  <header flex="none ~ wrap" h="16" items="center" justify="between" gap="3" p="x-4" border-b="1 solid #e2e8f0" bg="white">
    <h1 text="lg" font="semibold">
      Database Manager (Documents & Items)
    </h1>

    <div flex="~" items="center" gap="2" rounded="lg" border="1 solid #e2e8f0" bg="#f8fafc/70" p="1">
      <button
        type="button"
        rounded="md"
        p="x-3 y-1"
        text="sm"
        transition="all"
        :class="props.layoutMode === 'card' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'"
        @click="setLayoutMode('card')"
      >
        卡片式
      </button>

      <button
        type="button"
        rounded="md"
        p="x-3 y-1"
        text="sm"
        transition="all"
        :class="props.layoutMode === 'module' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'"
        @click="setLayoutMode('module')"
      >
        模块式
      </button>
    </div>
  </header>
</template>
