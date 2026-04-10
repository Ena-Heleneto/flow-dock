<script lang="ts" setup>
import type { LogEntry, LogEntryLevel } from '~/shared/composables/useLogger'
import { USE_LOGGER_KEY } from '~/shared/composables/useLogger'

const _userLogger = inject(USE_LOGGER_KEY)

if (!_userLogger)
  throw new Error('USE_LOGGER is not provided')

const { currentLog } = _userLogger
const contentRef = ref<HTMLElement | null>(null)
const expandedLogSet = reactive(new Set<LogEntry>())

const levelClassMap: Record<LogEntryLevel, string> = {
  INFO: 'bg-sky-100 text-sky-700',
  WARN: 'bg-amber-100 text-amber-700',
  ERROR: 'bg-rose-100 text-rose-700',
  DEBUG: 'bg-violet-100 text-violet-700',
}

function formatTimestamp(timestamp: Date) {
  return new Date(timestamp).toLocaleTimeString()
}

function createLogKey(timestamp: Date, index: number) {
  return `${new Date(timestamp).getTime()}-${index}`
}

function formatSingleLineMessage(message: string) {
  return message
    .replace(/\s+/g, ' ')
    .trim()
}

function isExpanded(entry: LogEntry) {
  return expandedLogSet.has(entry)
}

function toggleExpanded(entry: LogEntry) {
  if (expandedLogSet.has(entry))
    expandedLogSet.delete(entry)
  else
    expandedLogSet.add(entry)
}

watch(() => currentLog.value.length, async () => {
  await nextTick()
  if (contentRef.value)
    contentRef.value.scrollTop = contentRef.value.scrollHeight
}, { immediate: true })
</script>

<template>
  <div ref="contentRef" flex="~ col 1" min="h-0" overflow="y-auto" gap="2" p="x-3 y-2" bg="#f8fafc/40" scrollbar-none="~">
    <div
      v-for="(entry, index) in currentLog"
      :key="createLogKey(entry.timestamp, index)"
      rounded="md"
      border="1 solid #e2e8f0"
      bg="white"
      p="x-3 y-2"
      flex="~ col"
      gap="1"
      cursor="pointer"
      @click="toggleExpanded(entry)"
    >
      <div flex="~" items="center" gap="2" min-w="0">
        <span rounded="full" p="x-2 y-0.5" text="xs" font="600" :class="levelClassMap[entry.level]">
          {{ entry.level }}
        </span>

        <span v-if="!isExpanded(entry)" flex="1" min-w="0" truncate text="xs #1e293b" :title="entry.message">
          {{ formatSingleLineMessage(entry.message) }}
        </span>

        <span v-else text="xs #1e293b" font="medium">
          展开详情
        </span>

        <span flex="none" text="xs #64748b">
          {{ isExpanded(entry) ? '收起' : '展开' }}
        </span>

        <span text="xs #64748b" font="mono">
          {{ formatTimestamp(entry.timestamp) }}
        </span>
      </div>

      <pre
        v-if="isExpanded(entry)"
        m="0"
        whitespace="pre-wrap"
        break="all"
        text="xs #1e293b"
        leading="5"
        font="mono"
      >{{ entry.message }}</pre>
    </div>
  </div>
</template>
