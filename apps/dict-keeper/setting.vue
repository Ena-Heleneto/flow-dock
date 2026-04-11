<script lang="ts" setup>
import DictKeeperDrawer from './components/drawer/index.vue'
import { useDictKeeperConfig } from './composables/useDictKeeperConfig'

const drawerOpen = defineModel<boolean>('visible', { default: false })

const {
  form,
  configNameInput,
  selectedConfigId,
  configId,
  configsList,
  hasConfig,
  isListLoading,
  isLoading,
  isBusy,
  noticeText,
  noticeTone,
  validationErrors,
  refreshConfigList,
  loadConfig,
  loadConfigById,
  saveConfig,
  createConfigFromCurrent,
  deleteConfig,
} = useDictKeeperConfig()

const pendingDeleteConfirmation = ref(false)

const noticeClass = computed(() => {
  if (noticeTone.value === 'success')
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'

  if (noticeTone.value === 'error')
    return 'border-rose-200 bg-rose-50 text-rose-700'

  return 'border-slate-200 bg-slate-50 text-slate-600'
})

const drawerOpenModel = computed({
  get: () => drawerOpen.value,
  set: (nextOpen: boolean) => {
    drawerOpen.value = nextOpen
  },
})

async function handleDrawerOpen() {
  pendingDeleteConfirmation.value = false
  await loadConfig()
}

function handleDrawerClose() {
  pendingDeleteConfirmation.value = false
}

async function handleReload() {
  pendingDeleteConfirmation.value = false
  await loadConfig()
}

async function handleRefreshList() {
  pendingDeleteConfirmation.value = false
  await refreshConfigList()
}

async function handleLoadSelected() {
  pendingDeleteConfirmation.value = false
  await loadConfigById(selectedConfigId.value)
}

async function handleSelectChange() {
  pendingDeleteConfirmation.value = false

  if (!selectedConfigId.value)
    return

  await loadConfigById(selectedConfigId.value)
}

async function handleCreate() {
  pendingDeleteConfirmation.value = false
  await createConfigFromCurrent()
}

async function handleSave() {
  pendingDeleteConfirmation.value = false
  await saveConfig()
}

async function handleDelete() {
  if (!hasConfig.value)
    return

  if (!pendingDeleteConfirmation.value) {
    pendingDeleteConfirmation.value = true
    return
  }

  await deleteConfig()
  pendingDeleteConfirmation.value = false
}

function formatTimestamp(value: number | undefined) {
  if (!value)
    return '无更新时间'

  return new Date(value).toLocaleString()
}
</script>

<template>
  <DictKeeperDrawer v-model:open="drawerOpenModel" width="min(96vw, 46rem)">
    <template #header>
      <div flex="~" items="center" gap="2">
        <span text="sm semibold #0f172a">字典接口配置</span>
        <span text="xs #64748b">{{ configsList.length > 0 ? `已保存 ${configsList.length} 条配置` : '尚未创建后端配置' }}</span>
      </div>
    </template>

    <div flex="~ col" gap="4" @vue:mounted="handleDrawerOpen" @vue:unmounted="handleDrawerClose">
      <p text="xs #475569" leading="relaxed">
        填写接口基础路径与 8 个 CRUD 接口地址。保存策略：名称不变时更新当前已加载配置；若名称与已有配置同名则覆盖该同名配置；否则另存为新配置。删除为伪删除（isDeleted + deletedAt），删除后默认不在列表中显示。
      </p>

      <section class="dict-config-section">
        <h3 class="dict-config-title">
          配置列表
        </h3>

        <div class="dict-config-grid">
          <label class="dict-config-field">
            <span>配置名称</span>
            <input
              v-model="configNameInput"
              type="text"
              placeholder="例如：生产环境配置"
            >
          </label>

          <label class="dict-config-field">
            <span>选择配置</span>
            <select v-model="selectedConfigId" :disabled="configsList.length === 0 || isBusy" @change="handleSelectChange">
              <option value="" disabled>
                {{ configsList.length > 0 ? '请选择一个配置' : '暂无可选配置' }}
              </option>
              <option
                v-for="config in configsList"
                :key="config._id"
                :value="config._id"
              >
                {{ config.name }} · {{ formatTimestamp(config.updatedAt) }}
              </option>
            </select>
          </label>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="isBusy"
            @click="handleRefreshList"
          >
            刷新列表
          </button>

          <button
            type="button"
            class="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="!selectedConfigId || isBusy"
            @click="handleLoadSelected"
          >
            重新加载所选
          </button>

          <button
            type="button"
            class="rounded border border-emerald-600 bg-emerald-600 px-3 py-1.5 text-xs text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:border-emerald-400 disabled:bg-emerald-400"
            :disabled="isBusy"
            @click="handleCreate"
          >
            新建配置
          </button>
        </div>
      </section>

      <div v-if="noticeText" class="rounded-lg border px-3 py-2 text-xs" :class="noticeClass">
        {{ noticeText }}
      </div>

      <div
        v-if="pendingDeleteConfirmation"
        class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700"
      >
        已进入删除确认状态：再次点击「删除配置」将执行删除（伪删除）。
      </div>

      <ul v-if="validationErrors.length > 0" class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
        <li v-for="error in validationErrors" :key="error">
          • {{ error }}
        </li>
      </ul>

      <div v-if="isLoading" class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        正在从后端加载配置...
      </div>

      <div v-if="isListLoading" class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        正在刷新配置列表...
      </div>

      <form class="flex flex-col gap-4" @submit.prevent="handleSave">
        <section class="dict-config-section">
          <h3 class="dict-config-title">
            接口基础路径
          </h3>

          <label class="dict-config-field">
            <span>Base Path</span>
            <input
              v-model="form.basePath"
              type="text"
              placeholder="https://api.example.com/v1"
            >
          </label>
        </section>

        <section class="dict-config-section">
          <h3 class="dict-config-title">
            数据字典 CRUD 接口
          </h3>

          <div class="dict-config-grid">
            <label class="dict-config-field">
              <span>创建接口（create）</span>
              <input v-model="form.dictionary.create" type="text" placeholder="/dictionary/create">
            </label>

            <label class="dict-config-field">
              <span>读取接口（read）</span>
              <input v-model="form.dictionary.read" type="text" placeholder="/dictionary/read">
            </label>

            <label class="dict-config-field">
              <span>更新接口（update）</span>
              <input v-model="form.dictionary.update" type="text" placeholder="/dictionary/update">
            </label>

            <label class="dict-config-field">
              <span>删除接口（delete）</span>
              <input v-model="form.dictionary.delete" type="text" placeholder="/dictionary/delete">
            </label>
          </div>
        </section>

        <section class="dict-config-section">
          <h3 class="dict-config-title">
            字典项 CRUD 接口
          </h3>

          <div class="dict-config-grid">
            <label class="dict-config-field">
              <span>创建接口（create）</span>
              <input v-model="form.item.create" type="text" placeholder="/dictionary-item/create">
            </label>

            <label class="dict-config-field">
              <span>读取接口（read）</span>
              <input v-model="form.item.read" type="text" placeholder="/dictionary-item/read">
            </label>

            <label class="dict-config-field">
              <span>更新接口（update）</span>
              <input v-model="form.item.update" type="text" placeholder="/dictionary-item/update">
            </label>

            <label class="dict-config-field">
              <span>删除接口（delete）</span>
              <input v-model="form.item.delete" type="text" placeholder="/dictionary-item/delete">
            </label>
          </div>
        </section>
      </form>
    </div>

    <template #footer>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <span class="text-xs text-slate-500">
          {{ configId ? `当前配置 ID：${configId}` : '当前未选择配置' }}
        </span>

        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="isBusy"
            @click="handleReload"
          >
            重新加载
          </button>

          <button
            type="button"
            class="rounded border border-rose-300 bg-white px-3 py-1.5 text-xs text-rose-600 transition hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="!hasConfig || isBusy"
            @click="handleDelete"
          >
            {{ pendingDeleteConfirmation ? '再次点击确认删除' : '删除配置' }}
          </button>

          <button
            type="button"
            class="rounded border border-teal-600 bg-teal-600 px-3 py-1.5 text-xs text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:border-teal-400 disabled:bg-teal-400"
            :disabled="isBusy"
            @click="handleSave"
          >
            {{ hasConfig ? '保存配置' : '保存为新配置' }}
          </button>
        </div>
      </div>
    </template>
  </DictKeeperDrawer>
</template>

<style lang="scss" scoped>
.dict-config-section {
  border: 1px solid rgb(14 116 144 / 18%);
  border-radius: 0.75rem;
  background: rgb(248 250 252 / 92%);
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.dict-config-title {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 600;
  color: rgb(15 23 42 / 0.9);
}

.dict-config-grid {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 0.75rem;
}

@media (width >= 768px) {
  .dict-config-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.dict-config-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;

  span {
    font-size: 0.75rem;
    color: rgb(71 85 105 / 1);
  }

  :is(input, select) {
    width: 100%;
    border: 1px solid rgb(203 213 225 / 1);
    border-radius: 0.5rem;
    background: rgb(255 255 255 / 1);
    font-size: 0.8125rem;
    line-height: 1.25rem;
    color: rgb(15 23 42 / 1);
    padding: 0.5rem 0.75rem;
    outline: none;
    transition: border-color 0.15s ease;
  }

  :is(input, select):focus {
    border-color: rgb(13 148 136 / 0.95);
  }
}
</style>
