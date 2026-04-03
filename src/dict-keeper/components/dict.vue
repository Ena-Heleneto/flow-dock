<script lang="ts" setup>
const { item }
  = defineProps<{ item: { label: string, value: string, total: number, remark: string } }>()

const _total = computed(() => item.total > 999 ? '999+' : `${item.total.toString()}`)

const expand = ref<boolean>(false)
</script>

<template>
  <div
    w="full" p="x-3 y-4" rounded="3" border="1 solid #06b6d4/12" bg="gradient-to-r" from="#ffffff/90" to="#f8fafc/95"
    shadow="#06b6d4/3 md"
  >
    <div flex="~" items="center" justify="between">
      <div flex="~" items="center" gap="x-2">
        <input id="" type="checkbox" name="">

        <div
          text="4" h="6"
          :class="{ 'i-game-icons:bottom-right-3d-arrow': expand, 'i-game-icons:android-mask': !expand }"
          @click="expand = !expand"
        />

        <div text="4" h="6" i-game-icons:artificial-intelligence />
        <span> {{ item.label }} </span>
        <span> {{ item.value }} </span>
        <span> {{ _total }}</span>
        <span> {{ item.remark }} </span>
      </div>

      <div flex="~" items="center" gap="x-2">
        <div text="4" h="6" i-game-icons:abstract-016 />
        <div text="4" h="6" i-game-icons:abstract-016 />
        <div text="4" h="6" i-game-icons:abstract-016 />
        <div text="4" h="6" i-game-icons:abstract-016 />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
a {
  color: rgba(248, 250, 252, 0.95);
  color: #f8fafc;

  color: rgba(6, 182, 212, 0.03);
  color: #06b6d4;
}
</style>
