<script lang="ts" setup>
const { deleteCount = 0 } = defineProps<{ deleteCount?: number }>()

const showDeleteCount = computed(() => deleteCount > 0)
</script>

<template>
  <div w="full" flex="~" items="center" justify="between">
    <div flex="~" items="center" gap="x-4">
      <div flex="~" items="center" gap="x-1" cursor="pointer">
        <div text="4" h="6" i-game-icons:duel />
        <span>按时间</span>
      </div>

      <div flex="~" items="center" gap="x-1">
        <input id="checkAll" type="checkbox" name="">
        <label for="checkAll" cursor="pointer">全选</label>
      </div>

      <div v-if="showDeleteCount">
        <div text="4" h="6" i-game-icons:spade />
      </div>
    </div>

    <div flex="~" items="center" gap="x-2">
      <span>3</span>
      <span>/</span>
      <span>3</span>
      <span>字典</span>
    </div>
  </div>
</template>
