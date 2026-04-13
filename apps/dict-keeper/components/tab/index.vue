<script lang="ts" setup>
interface DictKeeperTabItem {
  key: string
  label: string
  disabled?: boolean
}

const { items = [] } = defineProps<{
  items?: DictKeeperTabItem[]
}>()

const activeKey = defineModel<string>('activeKey', { default: '' })

const enabledItems = computed(() => items.filter(item => !item.disabled))

const currentActiveKey = computed(() => {
  const current = items.find(item => item.key === activeKey.value && !item.disabled)
  if (current)
    return current.key

  return enabledItems.value[0]?.key ?? ''
})

function setActiveKey(nextKey: string, disabled?: boolean) {
  if (disabled)
    return

  if (nextKey === activeKey.value)
    return

  activeKey.value = nextKey
}
</script>

<template>
  <div class="dict-tab-root" w="full" flex="~ col" gap="2">
    <nav v-if="items.length" class="dict-tab-list" role="tablist" aria-label="dict keeper tabs">
      <button
        v-for="item in items"
        :id="`dict-tab-${item.key}`"
        :key="item.key"
        type="button"
        class="dict-tab-trigger"
        :class="{ 'is-active': item.key === currentActiveKey, 'is-disabled': item.disabled }"
        :disabled="item.disabled"
        role="tab"
        :aria-selected="item.key === currentActiveKey"
        :aria-controls="`dict-tab-panel-${item.key}`"
        @click="setActiveKey(item.key, item.disabled)"
      >
        {{ item.label }}
      </button>
    </nav>

    <section class="dict-tab-panels">
      <slot :active-key="currentActiveKey" />
    </section>
  </div>
</template>

<style lang="scss" scoped>
.dict-tab-list {
  display: flex;
  gap: 0.5rem;
  padding: 0.35rem;
  border: 1px solid rgb(14 116 144 / 20%);
  border-radius: 0.75rem;
  background: rgb(241 245 249 / 80%);
  overflow-x: auto;
}

.dict-tab-trigger {
  border: none;
  border-radius: 0.6rem;
  padding: 0.45rem 0.8rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: rgb(15 23 42 / 78%);
  background: transparent;
  cursor: pointer;
  transition: background-color 0.18s ease, color 0.18s ease;
}

.dict-tab-trigger:hover {
  background: rgb(14 116 144 / 8%);
}

.dict-tab-trigger.is-active {
  color: rgb(12 74 110);
  background: rgb(14 116 144 / 16%);
}

.dict-tab-trigger.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dict-tab-panels {
  min-height: 0;
}
</style>
