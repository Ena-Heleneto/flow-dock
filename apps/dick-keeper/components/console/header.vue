<script lang="ts" setup>
import { USE_LOGGER_KEY } from '../../composables/useLogger'

const _userLogger = inject(USE_LOGGER_KEY)

if (!_userLogger)
  throw new Error('USE_LOGGER is not provided')

const { LEVEL_LIST } = _userLogger

function handleSelectLevel() {}
</script>

<template>
  <div p="x-4 y-2" w="full" flex="~" items="center" justify="between">
    <div flex="~" items="center" gap="x-4">
      <div text="4" h="6" i-mdi-light:console />

      <span>LOG</span>

      <div flex="~" items="center" gap="x-2">
        <div>
          标识状态的水波纹
        </div>

        <div>
          <span>301</span>
          <span>log</span>
        </div>

        <div>
          <span>10</span>
          <span>err</span>
        </div>

        <div>
          <span>10</span>
          <span>warn</span>
        </div>
      </div>

      <div w="1px" h="stretch" bg="gray-300" />

      <div v-for="(item, index) in LEVEL_LIST" :key="index" @click="handleSelectLevel" v-text="item" />
    </div>

    <div flex="~" items="center" gap="x-2">
      <div i-game-icons:stopwatch text="4" h="6" />
      <div i-game-icons:nuclear text="4" h="6" />

      <div w="1px" h="stretch" bg="gray-300" />

      <div i-game-icons:armor-upgrade text="4" h="6" />
      <div i-game-icons:closed-barbute text="4" h="6" />
    </div>
  </div>
</template>
