<script lang="ts" setup>
import DictKeeperModal from './components/modal/index.vue'

const modalOpen = defineModel<boolean>('visible', { default: false })

const previewMetricList = [
  {
    label: '词条数量',
    value: '1,000',
    description: '当前工作区已加载的示例条目。',
  },
  {
    label: '待处理项',
    value: '201',
    description: '建议优先检查重复词条与空备注。',
  },
  {
    label: '最近改动',
    value: '12',
    description: '过去 24 小时内记录到的编辑动作。',
  },
]

const previewEntryList = [
  {
    term: 'flow dock',
    phonetic: '/floʊ dɑːk/',
    tag: '术语',
    remark: '用于标记当前工作区里与流程节点相关的核心表达。',
  },
  {
    term: 'batch import',
    phonetic: '/bætʃ ˈɪmpɔːrt/',
    tag: '动作',
    remark: '常见于批量导入面板，用于快速校验字段映射。',
  },
]
</script>

<template>
  <DictKeeperModal v-model:open="modalOpen" title="字典预览" width="min(92vw, 720px)">
    <div flex="~ col" gap="5">
      <section class="dict-preview-hero" flex="~ col" gap="3">
        <span class="dict-preview-badge">Workspace Snapshot</span>

        <div flex="~ col" gap="2">
          <h2 text="xl semibold #0f172a">
            当前预览窗口用于快速检查词典状态。
          </h2>

          <p text="sm #475569/92" leading="relaxed">
            这里可以先聚合关键指标、样例词条和最近动作，后续再接真实数据源与筛选条件。
          </p>
        </div>
      </section>

      <section class="dict-preview-metrics" grid="~ cols-1 md:cols-3" gap="3">
        <article
          v-for="metric in previewMetricList"
          :key="metric.label"
          class="dict-preview-card"
          flex="~ col"
          gap="2"
        >
          <span text="xs uppercase #0f766e/80" tracking="[0.18em]">{{ metric.label }}</span>
          <strong text="2xl #0f172a">{{ metric.value }}</strong>
          <p text="xs #475569">
            {{ metric.description }}
          </p>
        </article>
      </section>

      <section class="dict-preview-list" flex="~ col" gap="3">
        <div flex="~" items="center" justify="between" gap="3">
          <h3 text="sm semibold #0f172a">
            样例词条
          </h3>
          <span text="xs #64748b">Demo data</span>
        </div>

        <article
          v-for="entry in previewEntryList"
          :key="entry.term"
          class="dict-preview-entry"
          flex="~ col"
          gap="2"
        >
          <div flex="~" items="center" justify="between" gap="3">
            <div flex="~ col" gap="1">
              <strong text="base #0f172a">{{ entry.term }}</strong>
              <span text="xs #64748b">{{ entry.phonetic }}</span>
            </div>

            <span class="dict-preview-tag">{{ entry.tag }}</span>
          </div>

          <p text="sm #334155" leading="relaxed">
            {{ entry.remark }}
          </p>
        </article>
      </section>
    </div>

    <template #footer="{ close }">
      <div flex="~" justify="end">
        <button class="dict-preview-close" type="button" @click="close()">
          关闭预览
        </button>
      </div>
    </template>
  </DictKeeperModal>
</template>

<style lang="scss" scoped>
.dict-preview-hero {
  padding: 1.25rem;
  border: 1px solid rgb(8 145 178 / 16%);
  border-radius: 1rem;
  background:
    radial-gradient(circle at top right, rgb(6 182 212 / 14%), transparent 42%),
    linear-gradient(135deg, rgb(240 249 255 / 96%), rgb(248 250 252 / 100%));
}

.dict-preview-badge {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  justify-content: center;
  padding: 0.35rem 0.7rem;
  border-radius: 999px;
  background: rgb(14 165 233 / 10%);
  color: rgb(15 118 110 / 92%);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.dict-preview-card,
.dict-preview-entry {
  padding: 1rem;
  border: 1px solid rgb(14 116 144 / 16%);
  border-radius: 0.9rem;
  background: rgb(255 255 255 / 78%);
}

.dict-preview-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem 0.65rem;
  border-radius: 999px;
  background: rgb(6 182 212 / 10%);
  color: rgb(15 118 110 / 90%);
  font-size: 0.75rem;
  font-weight: 600;
}

.dict-preview-close {
  padding: 0.65rem 1.1rem;
  border: 0;
  border-radius: 0.8rem;
  background: linear-gradient(135deg, rgb(8 145 178), rgb(14 116 144));
  color: #fff;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
}
</style>
