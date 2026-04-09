<script lang="ts" setup>
import DictKeeperDrawer from './components/drawer/index.vue'
import DictKeeperTabs from './components/tab/index.vue'

const drawerOpen = defineModel<boolean>('visible', { default: false })

const tabPanelList = [
  {
    key: 'overview',
    label: '概览',
    title: '操作概览',
    description: '用于放置当前字典工作区的快速信息。',
  },
  {
    key: 'batch',
    label: '批处理',
    title: '批处理面板',
    description: '后续可接入批量导入、批量清理等操作入口。',
  },
  {
    key: 'history',
    label: '历史',
    title: '历史记录',
    description: '用于展示最近一次或一段时间的动作记录。',
  },
]

const activeTabKey = ref(tabPanelList[0]?.key ?? '')
</script>

<template>
  <DictKeeperDrawer v-model:open="drawerOpen">
    <template #header>
      <span text="sm semibold #0f172a">字典抽屉</span>
    </template>

    <div flex="~ col" gap="3">
      <DictKeeperTabs v-model:active-key="activeTabKey" :items="tabPanelList">
        <template #default="{ activeKey }">
          <section
            v-for="panel in tabPanelList"
            v-show="panel.key === activeKey"
            :id="`dict-tab-panel-${panel.key}`"
            :key="panel.key"
            class="dict-drawer-tab-panel"
            role="tabpanel"
            :aria-labelledby="`dict-tab-${panel.key}`"
            tabindex="0"
          >
            <div flex="~ col" gap="2">
              <p text="sm semibold #0f172a">
                {{ panel.title }}
              </p>

              <p text="xs #475569">
                {{ panel.description }}
              </p>
            </div>
          </section>
        </template>
      </DictKeeperTabs>
    </div>
  </DictKeeperDrawer>
</template>
