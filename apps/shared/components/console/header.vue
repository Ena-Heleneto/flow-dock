<script lang="ts" setup>
import type { LogLevel } from '~/shared/composables/useLogger'
import { USE_LOGGER_KEY } from '~/shared/composables/useLogger'

const _userLogger = inject(USE_LOGGER_KEY)

if (!_userLogger)
  throw new Error('USE_LOGGER is not provided')

const { LEVEL_LIST, currentLevel, setLevel, clearLog, levelStats, totalCount } = _userLogger

function handleSelectLevel(level: LogLevel) {
  setLevel(level)
}

function getLevelCount(level: LogLevel) {
  if (level === 'ALL')
    return totalCount.value

  return levelStats.value[level]
}
</script>

<template>
  <div p="x-4 y-3" w="full" flex="~ wrap" items="center" justify="between" gap="x-4 y-2" border-b="1 solid #e2e8f0" bg="#f8fafc/80">
    <div flex="~ wrap" items="center" gap="x-3 y-2">
      <div flex="~" items="center" gap="x-2" text="sm #0f172a" font="600">
        <div i-mdi:console-line text="4" h="5" />
        <span>Logs</span>
      </div>

      <div flex="~ wrap" items="center" gap="2">
        <button
          v-for="item in LEVEL_LIST"
          :key="item"
          type="button"
          rounded="full"
          border="1 solid #cbd5e1"
          p="x-3 y-1"
          text="xs"
          transition="all"
          :class="currentLevel === item ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-600 hover:border-slate-400'"
          @click="handleSelectLevel(item)"
        >
          <span>{{ item }}</span>
          <span m="l-1">{{ getLevelCount(item) }}</span>
        </button>
      </div>
    </div>

    <button
      type="button"
      rounded="md"
      border="1 solid #cbd5e1"
      bg="white"
      p="x-3 y-1"
      text="xs #475569"
      transition="all"
      hover="border-slate-400 text-slate-700"
      @click="clearLog"
    >
      Clear
    </button>
  </div>
</template>
