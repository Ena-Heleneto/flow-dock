<script lang="ts" setup>
import DictKeeperAuthConfig from '~/dict-keeper/auth-config.vue'
import DictKeeperDict from '~/dict-keeper/components/dict/index.vue'
import DictKeeperHeader from '~/dict-keeper/components/header/index.vue'
import DictKeeperToolbar from '~/dict-keeper/components/toolbar/index.vue'
import { useDictKeeperAuthConfig } from '~/dict-keeper/composables/useDictKeeperAuthConfig'
import { useDictKeeperExternalCrud } from '~/dict-keeper/composables/useDictKeeperExternalCrud'
import { useDictKeeperPendingRecorder } from '~/dict-keeper/composables/useDictKeeperPendingRecorder'
import { MOCK_LOG_LIST } from '~/dict-keeper/mock/log.mock'
import DictKeeperPreview from '~/dict-keeper/preview.vue'
import DictKeeperSetting from '~/dict-keeper/setting.vue'
import DictKeeperConsole from '~/shared/components/console/index.vue'
import { useLogger } from '~/shared/composables/useLogger'

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
const dictKeeperAuthConfigVisible = ref<boolean>(false)

const {
  actions: {
    resetConfig: resetAuthConfig,
  },
} = useDictKeeperAuthConfig()

const {
  state: {
    currentConfigSnapshot,
  },
  actions: {
    initializeExternalCrud,
  },
} = useDictKeeperExternalCrud()

const {
  state: {
    pendingCount: pendingRecorderPendingCount,
    noticeText: pendingRecorderNoticeText,
    noticeTone: pendingRecorderNoticeTone,
  },
  actions: {
    startPendingAutoSync,
    stopPendingAutoSync,
  },
} = useDictKeeperPendingRecorder()

const currentExternalCrudLabel = computed(() => {
  if (!currentConfigSnapshot.value)
    return '尚未加载外部 CRUD 配置'

  const snapshot = currentConfigSnapshot.value
  const defaultTag = snapshot.isDefault ? '（默认）' : ''
  return `${snapshot.name}${defaultTag} · ${snapshot.basePath || '未填写 Base Path'}`
})

const pendingRecorderNoticeClass = computed(() => {
  if (pendingRecorderNoticeTone.value === 'success')
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'

  if (pendingRecorderNoticeTone.value === 'error')
    return 'border-rose-200 bg-rose-50 text-rose-700'

  return 'border-slate-200 bg-slate-50 text-slate-600'
})

onMounted(() => {
  resetAuthConfig()
  void initializeExternalCrud({ silent: true })
  startPendingAutoSync()
})

onBeforeUnmount(() => {
  stopPendingAutoSync()
})

function handleSetting() {
  dictKeeperSettingVisible.value = true
}

function handlePreview() {
  dictKeeperPreviewVisible.value = true
}

function handleAuthConfig() {
  dictKeeperAuthConfigVisible.value = true
}
</script>

<template>
  <div size="screen" flex="~ col" items="center" min-h="0" class="dict-keeper-viewer" bg="#f0f4f8">
    <DictKeeperHeader @setting="handleSetting" @preview="handlePreview" @auth-config="handleAuthConfig" />

    <main flex="1 ~ col" min-h="0" w="xl:320 full" p="y-6 x-10 xl:x-0">
      <DictKeeperToolbar :delete-count="deleteCount" />

      <p class="dict-keeper-current-config">
        当前外部 CRUD：{{ currentExternalCrudLabel }}
      </p>

      <p v-if="pendingRecorderPendingCount > 0" class="dict-keeper-pending-count">
        待处理录制包：{{ pendingRecorderPendingCount }} 个
      </p>

      <div v-if="pendingRecorderNoticeText" class="dict-keeper-pending-notice" :class="pendingRecorderNoticeClass">
        {{ pendingRecorderNoticeText }}
      </div>

      <div
        m="t-4" flex="~ col 1" gap="3" min="h-0" w="full" overflow="auto"
        scrollbar-none="~"
      >
        <DictKeeperDict v-for="(_item, index) in testList" :key="index" :item="_item" />
      </div>
    </main>

    <DictKeeperConsole />
    <DictKeeperAuthConfig v-model:visible="dictKeeperAuthConfigVisible" />
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

.dict-keeper-current-config {
  margin: 0.75rem 0 0;
  padding: 0.45rem 0.65rem;
  border-radius: 0.5rem;
  border: 1px solid rgb(148 163 184 / 0.35);
  background: rgb(248 250 252 / 0.9);
  font-size: 0.75rem;
  color: rgb(51 65 85 / 0.95);
}

.dict-keeper-pending-count {
  margin: 0.5rem 0 0;
  font-size: 0.75rem;
  color: rgb(14 116 144 / 0.95);
}

.dict-keeper-pending-notice {
  margin-top: 0.5rem;
  border: 1px solid rgb(226 232 240 / 1);
  border-radius: 0.65rem;
  padding: 0.55rem 0.7rem;
  font-size: 0.75rem;
  line-height: 1.35;
}
</style>
