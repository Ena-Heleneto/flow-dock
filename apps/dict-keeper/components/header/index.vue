<script lang="ts" setup>
const emits = defineEmits<{
  setting: []
  preview: []
  authConfig: []
}>()
</script>

<template>
  <div w-full p="y-2 x-3" flex="~" items="center" gap="x-4" shadow="lg" bg="#f1f2f6">
    <div text="6" h="8" i-game-icons:cyber-eye />

    <div>DICT</div>

    <div w="1px" h="full" bg="gray-300" />

    <input type="text" border="~" w="1/3">

    <div flex="~" items="center" gap="x-1" cursor="pointer">
      <div text="4" h="6" i-game-icons:cloud-download />
      <span>导出</span>
    </div>

    <div flex="~" items="center" gap="x-1" cursor="pointer">
      <div text="4" h="6" i-game-icons:cloud-upload />
      <span>导入</span>
    </div>

    <button flex="~" items="center" gap="x-1" cursor="pointer" bg="blue-500" text="white" p="x-3 y-1" rounded="~">
      <div i-game-icons:hole-ladder />
      <span>新建</span>
    </button>

    <div w="1px" h="full" bg="gray-300" />

    <div>
      <span>绿色水波纹圆点</span>
      <span>201</span>
    </div>

    <div text="4" h="6" i-game-icons:bolt-eye cursor="pointer" @click="emits('preview')" />

    <div text="4" h="6" i-game-icons:keyring cursor="pointer" @click="emits('authConfig')" />

    <div text="4" h="6" i-game-icons:settings-knobs cursor="pointer" @click="emits('setting')" />

    <div flex="~" items="center" gap="x-1" cursor="pointer">
      <div text="4" h="6" i-game-icons:moon-bats />
      <div text="4" h="6" i-game-icons:sun />
    </div>
  </div>
</template>
