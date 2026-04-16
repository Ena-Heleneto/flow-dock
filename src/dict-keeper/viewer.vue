<script lang="ts" setup>
import DictKeeperHeader from './components/header.vue'
import DictKeeperTab from './components/tab.vue'
import DictKeeperDict from './components/dict.vue'
import DictKeeperConsole from './components/console.vue'

const deleteCount = ref(0)

const item = {
  label: '测试',
  value: 'test',
  total: 1000,
  remark: '这是一个测试',
}

const testList = computed(() => {
  const list = []
  for (let i = 0; i < 100; i++)
    list.push(item)

  return list
})
</script>

<template>
  <div size="screen" flex="~ col" items="center" min-h="0" class="dict-keeper-viewer" bg="#f0f4f8">
    <DictKeeperHeader />

    <main flex="1 ~ col" min-h="0" w="xl:320 full" p="y-6 x-10 xl:x-0">
      <DictKeeperTab :delete-count="deleteCount" />

      <div
        m="t-4" flex="~ col 1" gap="3" min="h-0" w="full" overflow="auto"
        scrollbar-none="~"
      >
        <DictKeeperDict v-for="(_item, index) in testList" :key="index" :item="_item" />
      </div>
    </main>

    <DictKeeperConsole />
  </div>
</template>

<style lang="scss" scoped>
.dict-keeper-viewer {
  * {
    box-sizing: border-box;
  }
}
</style>
