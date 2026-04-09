<script lang="ts" setup>
import { USE_LOGGER_KEY } from '../../composables/useLogger'

const _userLogger = inject(USE_LOGGER_KEY)

if (!_userLogger)
  throw new Error('USE_LOGGER is not provided')

const { currentLog } = _userLogger
</script>

<template>
  <div flex="~ col 1" overflow="y-auto" gap="y-2" scrollbar-none="~">
    <div
      v-for="({ level = '', message = '' }, index) in currentLog" :key="index" flex="~" p="x-20" items="center"
      gap="x-2"
    >
      <span>
        <span>[</span>
        <span>{{ level }}</span>
        <span>]</span>
      </span>

      <span>{{ message }}</span>
    </div>
  </div>
</template>
