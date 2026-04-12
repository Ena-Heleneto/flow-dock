<script lang="ts" setup>
import DictKeeperDrawer from './components/drawer/index.vue'
import { useDictKeeperExternalCrud } from './composables/useDictKeeperExternalCrud'

const drawerOpen = defineModel<boolean>('visible', { default: false })

const {
  form,
  externalCrudNameInput,
  selectedExternalCrudId,
  externalCrudId,
  externalCrudList,
  hasExternalCrud,
  isListLoading,
  isLoading,
  isBusy,
  noticeText,
  noticeTone,
  validationErrors,
  refreshExternalCrudList,
  loadExternalCrud,
  loadExternalCrudById,
  saveExternalCrud,
  createExternalCrudFromCurrent,
  deleteExternalCrud,
} = useDictKeeperExternalCrud()

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
  await loadExternalCrud()
}

function handleDrawerClose() {
  pendingDeleteConfirmation.value = false
}

async function handleReload() {
  pendingDeleteConfirmation.value = false
  await loadExternalCrud()
}

async function handleRefreshList() {
  pendingDeleteConfirmation.value = false
  await refreshExternalCrudList()
}

async function handleLoadSelected() {
  pendingDeleteConfirmation.value = false
  await loadExternalCrudById(selectedExternalCrudId.value)
}

async function handleSelectChange() {
  pendingDeleteConfirmation.value = false

  if (!selectedExternalCrudId.value)
    return

  await loadExternalCrudById(selectedExternalCrudId.value)
}

async function handleCreate() {
  pendingDeleteConfirmation.value = false
  await createExternalCrudFromCurrent()
}

async function handleSave() {
  pendingDeleteConfirmation.value = false
  await saveExternalCrud()
}

async function handleDelete() {
  if (!hasExternalCrud.value)
    return

  if (!pendingDeleteConfirmation.value) {
    pendingDeleteConfirmation.value = true
    return
  }

  await deleteExternalCrud()
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
        <span text="sm semibold #0f172a">字典外部 CRUD</span>
        <span text="xs #64748b">{{ externalCrudList.length > 0 ? `已保存 ${externalCrudList.length} 条记录` : '尚未创建外部 CRUD' }}</span>
      </div>
    </template>

    <div flex="~ col" gap="4" @vue:mounted="handleDrawerOpen" @vue:unmounted="handleDrawerClose">
      <p text="xs #475569" leading="relaxed">
        填写接口基础路径与 8 个 CRUD 接口地址。保存策略：名称不变时更新当前已加载记录；若名称与已有记录同名则覆盖该同名记录；否则另存为新记录。删除为伪删除（isDeleted + deletedAt），删除后默认不在列表中显示。
      </p>

      <section class="dict-external-crud-section">
        <h3 class="dict-external-crud-title">
          外部 CRUD 列表
        </h3>

        <div class="dict-external-crud-grid">
          <label class="dict-external-crud-field">
            <span>外部 CRUD 名称</span>
            <input
              v-model="externalCrudNameInput"
              type="text"
              placeholder="例如：生产环境外部 CRUD"
            >
          </label>

          <label class="dict-external-crud-field">
            <span>选择记录</span>
            <select v-model="selectedExternalCrudId" :disabled="externalCrudList.length === 0 || isBusy" @change="handleSelectChange">
              <option value="" disabled>
                {{ externalCrudList.length > 0 ? '请选择一条记录' : '暂无可选记录' }}
              </option>
              <option
                v-for="externalCrud in externalCrudList"
                :key="externalCrud._id"
                :value="externalCrud._id"
              >
                {{ externalCrud.name }} · {{ formatTimestamp(externalCrud.updatedAt) }}
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
            :disabled="!selectedExternalCrudId || isBusy"
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
            新建记录
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
        已进入删除确认状态：再次点击「删除记录」将执行删除（伪删除）。
      </div>

      <ul v-if="validationErrors.length > 0" class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
        <li v-for="error in validationErrors" :key="error">
          • {{ error }}
        </li>
      </ul>

      <div v-if="isLoading" class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        正在从后端加载外部 CRUD...
      </div>

      <div
        v-if="isListLoading && externalCrudList.length > 0"
        class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"
      >
        正在刷新外部 CRUD 列表...
      </div>

      <div
        v-else-if="isListLoading"
        class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"
      >
        正在初始化外部 CRUD...
      </div>

      <form class="flex flex-col gap-4" @submit.prevent="handleSave">
        <section class="dict-external-crud-section">
          <h3 class="dict-external-crud-title">
            接口基础路径
          </h3>

          <label class="dict-external-crud-field">
            <span>Base Path</span>
            <input
              v-model="form.basePath"
              type="text"
              placeholder="https://api.example.com/v1"
            >
          </label>
        </section>

        <section class="dict-external-crud-section">
          <h3 class="dict-external-crud-title">
            数据字典 CRUD 接口
          </h3>

          <div class="dict-external-crud-grid">
            <label class="dict-external-crud-field">
              <span>创建接口（create）</span>
              <input v-model="form.dictionary.create" type="text" placeholder="/dictionary/create">
            </label>

            <label class="dict-external-crud-field">
              <span>读取接口（read）</span>
              <input v-model="form.dictionary.read" type="text" placeholder="/dictionary/read">
            </label>

            <label class="dict-external-crud-field">
              <span>更新接口（update）</span>
              <input v-model="form.dictionary.update" type="text" placeholder="/dictionary/update">
            </label>

            <label class="dict-external-crud-field">
              <span>删除接口（delete）</span>
              <input v-model="form.dictionary.delete" type="text" placeholder="/dictionary/delete">
            </label>
          </div>
        </section>

        <section class="dict-external-crud-section">
          <h3 class="dict-external-crud-title">
            字典项 CRUD 接口
          </h3>

          <div class="dict-external-crud-grid">
            <label class="dict-external-crud-field">
              <span>创建接口（create）</span>
              <input v-model="form.item.create" type="text" placeholder="/dictionary-item/create">
            </label>

            <label class="dict-external-crud-field">
              <span>读取接口（read）</span>
              <input v-model="form.item.read" type="text" placeholder="/dictionary-item/read">
            </label>

            <label class="dict-external-crud-field">
              <span>更新接口（update）</span>
              <input v-model="form.item.update" type="text" placeholder="/dictionary-item/update">
            </label>

            <label class="dict-external-crud-field">
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
          {{ externalCrudId ? `当前外部 CRUD ID：${externalCrudId}` : '当前未选择外部 CRUD' }}
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
            :disabled="!hasExternalCrud || isBusy"
            @click="handleDelete"
          >
            {{ pendingDeleteConfirmation ? '再次点击确认删除' : '删除记录' }}
          </button>

          <button
            type="button"
            class="rounded border border-teal-600 bg-teal-600 px-3 py-1.5 text-xs text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:border-teal-400 disabled:bg-teal-400"
            :disabled="isBusy"
            @click="handleSave"
          >
            {{ hasExternalCrud ? '保存记录' : '保存为新记录' }}
          </button>
        </div>
      </div>
    </template>
  </DictKeeperDrawer>
</template>

<style lang="scss" scoped>
.dict-external-crud-section {
  border: 1px solid rgb(14 116 144 / 18%);
  border-radius: 0.75rem;
  background: rgb(248 250 252 / 92%);
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.dict-external-crud-title {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 600;
  color: rgb(15 23 42 / 0.9);
}

.dict-external-crud-grid {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 0.75rem;
}

@media (width >= 768px) {
  .dict-external-crud-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.dict-external-crud-field {
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
