<script lang="ts" setup>
import DictKeeperDrawer from './components/drawer/index.vue'
import DictKeeperTab from './components/tab/index.vue'
import { REQUEST_METHOD_OPTIONS, useDictKeeperExternalCrud } from './composables/useDictKeeperExternalCrud'

type CrudTabKey = 'dictionary' | 'item'

const CRUD_TAB_ITEMS: Array<{ key: CrudTabKey, label: string }> = [
  { key: 'dictionary', label: '数据字典 CRUD' },
  { key: 'item', label: '字典项 CRUD' },
]

const DICTIONARY_ERROR_PATTERN = /^字典-(?:创建|读取|更新|删除)接口/
const ITEM_ERROR_PATTERN = /^字典项-(?:创建|读取|更新|删除)接口/

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
const requestMethodOptions = REQUEST_METHOD_OPTIONS
const crudTabItems = CRUD_TAB_ITEMS
const activeCrudTab = ref<CrudTabKey>('dictionary')

watch(validationErrors, (errors) => {
  const inferredTab = inferCrudTabFromErrors(errors)
  if (!inferredTab)
    return

  activeCrudTab.value = inferredTab
})

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

function inferCrudTabFromErrors(errors: string[]) {
  if (errors.some(error => ITEM_ERROR_PATTERN.test(error)))
    return 'item' as const

  if (errors.some(error => DICTIONARY_ERROR_PATTERN.test(error)))
    return 'dictionary' as const

  return null
}

function switchToCrudTab(tab: CrudTabKey) {
  activeCrudTab.value = tab
}
</script>

<template>
  <DictKeeperDrawer v-model:open="drawerOpenModel" width="min(98vw, 56rem)">
    <template #header>
      <div flex="~" items="center" gap="2">
        <span text="sm semibold #0f172a">字典外部 CRUD</span>
        <span text="xs #64748b">{{ externalCrudList.length > 0 ? `已保存 ${externalCrudList.length} 条记录` : '尚未创建外部 CRUD' }}</span>
      </div>
    </template>

    <div flex="~ col" gap="5" @vue:mounted="handleDrawerOpen" @vue:unmounted="handleDrawerClose">
      <p text="xs #475569" leading="relaxed">
        填写接口基础路径与 8 个 CRUD 接口（每个接口均需配置地址与请求方式）。保存策略：名称不变时更新当前已加载记录；若名称与已有记录同名则覆盖该同名记录；否则另存为新记录。删除为伪删除（isDeleted + deletedAt），删除后默认不在列表中显示。
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

      <div v-if="validationErrors.length > 0" class="dict-external-crud-validation">
        <div class="dict-external-crud-validation-header">
          <span>请先修正以下校验问题：</span>

          <div class="dict-external-crud-validation-actions">
            <button
              type="button"
              class="dict-external-crud-link"
              @click="switchToCrudTab('dictionary')"
            >
              跳转到数据字典接口
            </button>

            <button
              type="button"
              class="dict-external-crud-link"
              @click="switchToCrudTab('item')"
            >
              跳转到字典项接口
            </button>
          </div>
        </div>

        <ul class="dict-external-crud-validation-list">
          <li v-for="error in validationErrors" :key="error">
            • {{ error }}
          </li>
        </ul>
      </div>

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
          <div class="dict-external-crud-section-head">
            <h3 class="dict-external-crud-title">
              CRUD 接口配置
            </h3>

            <span class="dict-external-crud-caption">
              通过分组切换编辑接口，减少同屏字段数量。
            </span>
          </div>

          <DictKeeperTab
            v-model:active-key="activeCrudTab"
            :items="crudTabItems"
            class="dict-external-crud-tab-root"
          >
            <template #default="{ activeKey }">
              <section
                v-if="activeKey === 'dictionary'"
                id="dict-tab-panel-dictionary"
                class="dict-external-crud-tab-panel"
                role="tabpanel"
                aria-labelledby="dict-tab-dictionary"
              >
                <h4 class="dict-external-crud-subtitle">
                  数据字典 CRUD 接口
                </h4>

                <div class="dict-external-crud-grid dict-external-crud-grid--single">
                  <label class="dict-external-crud-field">
                    <span>创建接口（create）</span>
                    <div class="dict-external-crud-endpoint-control">
                      <input v-model="form.dictionary.create.path" type="text" placeholder="/dictionary/create">
                      <select v-model="form.dictionary.create.method">
                        <option value="">
                          请选择请求方式
                        </option>
                        <option v-for="method in requestMethodOptions" :key="`dictionary-create-${method}`" :value="method">
                          {{ method }}
                        </option>
                      </select>
                    </div>
                  </label>

                  <label class="dict-external-crud-field">
                    <span>读取接口（read）</span>
                    <div class="dict-external-crud-endpoint-control">
                      <input v-model="form.dictionary.read.path" type="text" placeholder="/dictionary/read">
                      <select v-model="form.dictionary.read.method">
                        <option value="">
                          请选择请求方式
                        </option>
                        <option v-for="method in requestMethodOptions" :key="`dictionary-read-${method}`" :value="method">
                          {{ method }}
                        </option>
                      </select>
                    </div>
                  </label>

                  <label class="dict-external-crud-field">
                    <span>更新接口（update）</span>
                    <div class="dict-external-crud-endpoint-control">
                      <input v-model="form.dictionary.update.path" type="text" placeholder="/dictionary/update">
                      <select v-model="form.dictionary.update.method">
                        <option value="">
                          请选择请求方式
                        </option>
                        <option v-for="method in requestMethodOptions" :key="`dictionary-update-${method}`" :value="method">
                          {{ method }}
                        </option>
                      </select>
                    </div>
                  </label>

                  <label class="dict-external-crud-field">
                    <span>删除接口（delete）</span>
                    <div class="dict-external-crud-endpoint-control">
                      <input v-model="form.dictionary.delete.path" type="text" placeholder="/dictionary/delete">
                      <select v-model="form.dictionary.delete.method">
                        <option value="">
                          请选择请求方式
                        </option>
                        <option v-for="method in requestMethodOptions" :key="`dictionary-delete-${method}`" :value="method">
                          {{ method }}
                        </option>
                      </select>
                    </div>
                  </label>
                </div>
              </section>

              <section
                v-else
                id="dict-tab-panel-item"
                class="dict-external-crud-tab-panel"
                role="tabpanel"
                aria-labelledby="dict-tab-item"
              >
                <h4 class="dict-external-crud-subtitle">
                  字典项 CRUD 接口
                </h4>

                <div class="dict-external-crud-grid dict-external-crud-grid--single">
                  <label class="dict-external-crud-field">
                    <span>创建接口（create）</span>
                    <div class="dict-external-crud-endpoint-control">
                      <input v-model="form.item.create.path" type="text" placeholder="/dictionary-item/create">
                      <select v-model="form.item.create.method">
                        <option value="">
                          请选择请求方式
                        </option>
                        <option v-for="method in requestMethodOptions" :key="`item-create-${method}`" :value="method">
                          {{ method }}
                        </option>
                      </select>
                    </div>
                  </label>

                  <label class="dict-external-crud-field">
                    <span>读取接口（read）</span>
                    <div class="dict-external-crud-endpoint-control">
                      <input v-model="form.item.read.path" type="text" placeholder="/dictionary-item/read">
                      <select v-model="form.item.read.method">
                        <option value="">
                          请选择请求方式
                        </option>
                        <option v-for="method in requestMethodOptions" :key="`item-read-${method}`" :value="method">
                          {{ method }}
                        </option>
                      </select>
                    </div>
                  </label>

                  <label class="dict-external-crud-field">
                    <span>更新接口（update）</span>
                    <div class="dict-external-crud-endpoint-control">
                      <input v-model="form.item.update.path" type="text" placeholder="/dictionary-item/update">
                      <select v-model="form.item.update.method">
                        <option value="">
                          请选择请求方式
                        </option>
                        <option v-for="method in requestMethodOptions" :key="`item-update-${method}`" :value="method">
                          {{ method }}
                        </option>
                      </select>
                    </div>
                  </label>

                  <label class="dict-external-crud-field">
                    <span>删除接口（delete）</span>
                    <div class="dict-external-crud-endpoint-control">
                      <input v-model="form.item.delete.path" type="text" placeholder="/dictionary-item/delete">
                      <select v-model="form.item.delete.method">
                        <option value="">
                          请选择请求方式
                        </option>
                        <option v-for="method in requestMethodOptions" :key="`item-delete-${method}`" :value="method">
                          {{ method }}
                        </option>
                      </select>
                    </div>
                  </label>
                </div>
              </section>
            </template>
          </DictKeeperTab>
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
  padding: 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.dict-external-crud-title {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 600;
  color: rgb(15 23 42 / 0.9);
}

.dict-external-crud-section-head {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.dict-external-crud-caption {
  font-size: 0.75rem;
  color: rgb(71 85 105 / 0.95);
}

.dict-external-crud-tab-root {
  min-width: 0;
}

.dict-external-crud-tab-panel {
  border: 1px solid rgb(14 116 144 / 14%);
  border-radius: 0.75rem;
  background: rgb(255 255 255 / 88%);
  padding: 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.dict-external-crud-subtitle {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 600;
  color: rgb(15 23 42 / 0.86);
}

.dict-external-crud-grid {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 0.875rem;
}

@media (width >= 960px) {
  .dict-external-crud-grid:not(.dict-external-crud-grid--single) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.dict-external-crud-grid--single {
  grid-template-columns: repeat(1, minmax(0, 1fr));
}

.dict-external-crud-field {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;

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
    padding: 0.55rem 0.75rem;
    outline: none;
    transition: border-color 0.15s ease;
  }

  :is(input, select):focus {
    border-color: rgb(13 148 136 / 0.95);
  }
}

.dict-external-crud-endpoint-control {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(6.75rem, 10.5rem);
  gap: 0.5rem;
  align-items: center;
}

@media (width < 720px) {
  .dict-external-crud-endpoint-control {
    grid-template-columns: repeat(1, minmax(0, 1fr));
  }
}

.dict-external-crud-validation {
  border-radius: 0.75rem;
  border: 1px solid rgb(254 205 211 / 1);
  background: rgb(255 241 242 / 1);
  padding: 0.75rem 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  font-size: 0.75rem;
  color: rgb(190 18 60 / 0.9);
}

.dict-external-crud-validation-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.dict-external-crud-validation-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.dict-external-crud-link {
  border: 1px solid rgb(251 113 133 / 0.3);
  border-radius: 0.5rem;
  background: rgb(255 255 255 / 0.7);
  color: rgb(190 18 60 / 0.92);
  font-size: 0.72rem;
  line-height: 1.1rem;
  padding: 0.2rem 0.55rem;
  cursor: pointer;
}

.dict-external-crud-link:hover {
  border-color: rgb(244 63 94 / 0.5);
}

.dict-external-crud-validation-list {
  margin: 0;
  padding-inline-start: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
</style>
