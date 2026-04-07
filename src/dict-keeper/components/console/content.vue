<script lang="ts" setup>
import { USE_LOGGER_KEY } from '../../composables/useLogger'

const _userLogger = inject(USE_LOGGER_KEY)

if (!_userLogger)
  throw new Error('USE_LOGGER is not provided')

const { currentLog } = _userLogger
</script>

<template>
  <div flex="~ col" overflow="y-auto">
    <div v-for="(item, index) in currentLog" :key="index" v-text="item" />
  </div>
</template>
