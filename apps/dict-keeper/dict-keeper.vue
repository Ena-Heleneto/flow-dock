<script lang="ts" setup>
import DictKeeperConsole from '~/shared/components/console/index.vue'
import { useLogger } from '~/shared/composables/useLogger'
import DictKeeperDict from './components/dict/index.vue'
import DictKeeperHeader from './components/header/index.vue'
import DictKeeperToolbar from './components/toolbar/index.vue'
import { MOCK_LOG_LIST } from './mock/log.mock'
import DictKeeperPreview from './preview.vue'
import DictKeeperSetting from './setting.vue'

const deleteCount = ref(0)

const { insertManyLogs } = useLogger()
insertManyLogs(MOCK_LOG_LIST)

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

const dictKeeperSettingVisible = ref<boolean>(false)
const dictKeeperPreviewVisible = ref<boolean>(false)

function handleSetting() {
  dictKeeperSettingVisible.value = true
}

function handlePreview() {
  dictKeeperPreviewVisible.value = true
}
</script>

<template>
  <div size="screen" flex="~ col" items="center" min-h="0" class="dict-keeper-viewer" bg="#f0f4f8">
    <DictKeeperHeader @setting="handleSetting" @preview="handlePreview" />

    <main flex="1 ~ col" min-h="0" w="xl:320 full" p="y-6 x-10 xl:x-0">
      <DictKeeperToolbar :delete-count="deleteCount" />

      <div
        m="t-4" flex="~ col 1" gap="3" min="h-0" w="full" overflow="auto"
        scrollbar-none="~"
      >
        <DictKeeperDict v-for="(_item, index) in testList" :key="index" :item="_item" />
      </div>
    </main>

    <DictKeeperConsole />
    <DictKeeperSetting v-model:visible="dictKeeperSettingVisible" />
    <DictKeeperPreview v-model:visible="dictKeeperPreviewVisible" />
  </div>
</template>

<style lang="scss" scoped>
.dict-keeper-viewer {
  * {
    box-sizing: border-box;
  }
}

.dict-drawer-tab-panel {
  border: 1px solid rgb(14 116 144 / 18%);
  border-radius: 0.75rem;
  background: rgb(248 250 252 / 92%);
  padding: 0.75rem 1rem;
}
</style>
