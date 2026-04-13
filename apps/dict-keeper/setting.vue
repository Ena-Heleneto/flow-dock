<script lang="ts" setup>
import type {
  DictKeeperCrudEndpointNode,
  DictKeeperCrudSection,
} from './composables/useDictKeeperExternalCrud'

import DictKeeperDrawer from './components/drawer/index.vue'
import DictKeeperTab from './components/tab/index.vue'
import {
  ENDPOINT_MERGE_STRATEGY_OPTIONS,
  REQUEST_METHOD_OPTIONS,
  useDictKeeperExternalCrud,
} from './composables/useDictKeeperExternalCrud'

type CrudTabKey = 'dictionary' | 'item'
type EndpointActionKey = 'create' | 'read' | 'update' | 'delete'

interface EndpointTemplateDraft {
  queryTemplateText: string
  headerTemplateText: string
  bodyTemplateText: string
}

interface EndpointActionMeta {
  key: EndpointActionKey
  actionLabel: string
  label: string
  dictionaryPlaceholder: string
  itemPlaceholder: string
}

interface EndpointEditRow {
  section: DictKeeperCrudSection
  key: EndpointActionKey
  label: string
  placeholder: string
  node: DictKeeperCrudEndpointNode
  draft: EndpointTemplateDraft
}

const CRUD_TAB_ITEMS: Array<{ key: CrudTabKey, label: string }> = [
  { key: 'dictionary', label: '数据字典 CRUD' },
  { key: 'item', label: '字典项 CRUD' },
]

const ENDPOINT_ACTIONS: EndpointActionMeta[] = [
  {
    key: 'create',
    actionLabel: '创建',
    label: '创建接口（create）',
    dictionaryPlaceholder: '/dictionary/create',
    itemPlaceholder: '/dictionary-item/create',
  },
  {
    key: 'read',
    actionLabel: '读取',
    label: '读取接口（read）',
    dictionaryPlaceholder: '/dictionary/read',
    itemPlaceholder: '/dictionary-item/read',
  },
  {
    key: 'update',
    actionLabel: '更新',
    label: '更新接口（update）',
    dictionaryPlaceholder: '/dictionary/update',
    itemPlaceholder: '/dictionary-item/update',
  },
  {
    key: 'delete',
    actionLabel: '删除',
    label: '删除接口（delete）',
    dictionaryPlaceholder: '/dictionary/delete',
    itemPlaceholder: '/dictionary-item/delete',
  },
]

const SECTION_LABEL_MAP: Record<DictKeeperCrudSection, string> = {
  dictionary: '字典',
  item: '字典项',
}

const CONTENT_TYPE_OPTIONS = [
  { label: '自动（有 body 时默认 JSON）', value: '' },
  { label: 'application/json', value: 'application/json' },
  { label: 'application/x-www-form-urlencoded', value: 'application/x-www-form-urlencoded' },
  { label: 'text/plain', value: 'text/plain' },
]

const ENDPOINT_MERGE_STRATEGY_LABELS: Record<string, string> = {
  'auth-overrides': 'auth-overrides（鉴权参数优先）',
  'payload-overrides': 'payload-overrides（payload 参数优先）',
}

const DICTIONARY_ERROR_PATTERN = /^字典-(?:创建|读取|更新|删除)接口/
const ITEM_ERROR_PATTERN = /^字典项-(?:创建|读取|更新|删除)接口/

const drawerOpen = defineModel<boolean>('visible', { default: false })

const externalCrudStore = useDictKeeperExternalCrud()

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
} = externalCrudStore.state

const {
  initializeExternalCrud,
  refreshExternalCrudList,
  loadExternalCrudById,
  saveExternalCrud,
  createExternalCrudFromCurrent,
  deleteExternalCrud,
  selectExternalCrudAsDefault,
} = externalCrudStore.actions

const pendingDeleteConfirmation = ref(false)
const requestMethodOptions = REQUEST_METHOD_OPTIONS
const crudTabItems = CRUD_TAB_ITEMS
const endpointMergeStrategyOptions = ENDPOINT_MERGE_STRATEGY_OPTIONS
const activeCrudTab = ref<CrudTabKey>('dictionary')
const templateValidationErrors = ref<string[]>([])

const endpointTemplateDrafts = reactive<Record<DictKeeperCrudSection, Record<EndpointActionKey, EndpointTemplateDraft>>>(
  createTemplateDraftGroups(),
)

const dictionaryEndpointRows = computed<EndpointEditRow[]>(() => {
  return ENDPOINT_ACTIONS.map((meta) => {
    return {
      section: 'dictionary',
      key: meta.key,
      label: meta.label,
      placeholder: meta.dictionaryPlaceholder,
      node: form.dictionary[meta.key],
      draft: endpointTemplateDrafts.dictionary[meta.key],
    }
  })
})

const itemEndpointRows = computed<EndpointEditRow[]>(() => {
  return ENDPOINT_ACTIONS.map((meta) => {
    return {
      section: 'item',
      key: meta.key,
      label: meta.label,
      placeholder: meta.itemPlaceholder,
      node: form.item[meta.key],
      draft: endpointTemplateDrafts.item[meta.key],
    }
  })
})

const endpointRowsByTab = computed(() => {
  return activeCrudTab.value === 'dictionary'
    ? dictionaryEndpointRows.value
    : itemEndpointRows.value
})

const allValidationErrors = computed(() => {
  if (templateValidationErrors.value.length === 0)
    return validationErrors.value

  return [...validationErrors.value, ...templateValidationErrors.value]
})

watch(allValidationErrors, (errors) => {
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
  await initializeExternalCrud()

  syncTemplateDraftsFromForm()
  clearTemplateValidationErrors()
}

function handleDrawerClose() {
  pendingDeleteConfirmation.value = false
  clearTemplateValidationErrors()
}

async function handleReload() {
  pendingDeleteConfirmation.value = false
  await initializeExternalCrud()

  syncTemplateDraftsFromForm()
  clearTemplateValidationErrors()
}

async function handleRefreshList() {
  pendingDeleteConfirmation.value = false
  await refreshExternalCrudList()
}

async function handleLoadSelected() {
  pendingDeleteConfirmation.value = false
  const loaded = await loadExternalCrudById(selectedExternalCrudId.value)
  if (loaded)
    syncTemplateDraftsFromForm()

  clearTemplateValidationErrors()
}

async function handleSelectChange() {
  pendingDeleteConfirmation.value = false

  if (!selectedExternalCrudId.value)
    return

  const loaded = await selectExternalCrudAsDefault(selectedExternalCrudId.value)
  if (loaded)
    syncTemplateDraftsFromForm()

  clearTemplateValidationErrors()
}

async function handleCreate() {
  pendingDeleteConfirmation.value = false
  if (!applyTemplateDraftsToForm())
    return

  const created = await createExternalCrudFromCurrent()
  if (created)
    syncTemplateDraftsFromForm()
}

async function handleSave() {
  pendingDeleteConfirmation.value = false
  if (!applyTemplateDraftsToForm())
    return

  const saved = await saveExternalCrud()
  if (saved)
    syncTemplateDraftsFromForm()
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
  syncTemplateDraftsFromForm()
  clearTemplateValidationErrors()
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

function createTemplateDraftGroups(): Record<DictKeeperCrudSection, Record<EndpointActionKey, EndpointTemplateDraft>> {
  return {
    dictionary: {
      create: createTemplateDraft(),
      read: createTemplateDraft(),
      update: createTemplateDraft(),
      delete: createTemplateDraft(),
    },
    item: {
      create: createTemplateDraft(),
      read: createTemplateDraft(),
      update: createTemplateDraft(),
      delete: createTemplateDraft(),
    },
  }
}

function createTemplateDraft(): EndpointTemplateDraft {
  return {
    queryTemplateText: '',
    headerTemplateText: '',
    bodyTemplateText: '',
  }
}

function syncTemplateDraftsFromForm() {
  const sections: DictKeeperCrudSection[] = ['dictionary', 'item']

  for (const section of sections) {
    for (const action of ENDPOINT_ACTIONS) {
      const node = getEndpointNode(section, action.key)
      const draft = endpointTemplateDrafts[section][action.key]

      draft.queryTemplateText = stringifyJsonTemplate(node.queryTemplate)
      draft.headerTemplateText = stringifyJsonTemplate(node.headerTemplate)
      draft.bodyTemplateText = stringifyJsonTemplate(node.bodyTemplate)
    }
  }
}

function applyTemplateDraftsToForm() {
  clearTemplateValidationErrors()

  const nextErrors: string[] = []
  const sections: DictKeeperCrudSection[] = ['dictionary', 'item']

  for (const section of sections) {
    for (const actionMeta of ENDPOINT_ACTIONS) {
      const action = actionMeta.key
      const node = getEndpointNode(section, action)
      const draft = endpointTemplateDrafts[section][action]
      const endpointLabel = `${SECTION_LABEL_MAP[section]}-${actionMeta.actionLabel}接口`

      const parsedQueryTemplate = parseTemplateRecord(draft.queryTemplateText, `${endpointLabel} Query 模板`)
      if (!parsedQueryTemplate.ok) {
        nextErrors.push(parsedQueryTemplate.error)
      }
      else {
        node.queryTemplate = parsedQueryTemplate.value
      }

      const parsedHeaderTemplate = parseTemplateRecord(draft.headerTemplateText, `${endpointLabel} Header 模板`)
      if (!parsedHeaderTemplate.ok) {
        nextErrors.push(parsedHeaderTemplate.error)
      }
      else {
        node.headerTemplate = parsedHeaderTemplate.value
      }

      const parsedBodyTemplate = parseTemplateJson(draft.bodyTemplateText, `${endpointLabel} Body 模板`)
      if (!parsedBodyTemplate.ok) {
        nextErrors.push(parsedBodyTemplate.error)
      }
      else {
        node.bodyTemplate = parsedBodyTemplate.value
      }
    }
  }

  templateValidationErrors.value = nextErrors
  return nextErrors.length === 0
}

function parseTemplateRecord(
  sourceText: string,
  label: string,
): { ok: true, value: Record<string, string> | undefined } | { ok: false, error: string } {
  const normalized = sourceText.trim()
  if (!normalized)
    return { ok: true, value: undefined }

  let parsedValue: unknown
  try {
    parsedValue = JSON.parse(normalized)
  }
  catch (error) {
    return {
      ok: false,
      error: `${label} JSON 解析失败：${toErrorMessage(error)}`,
    }
  }

  if (!parsedValue || typeof parsedValue !== 'object' || Array.isArray(parsedValue)) {
    return {
      ok: false,
      error: `${label} 必须是 JSON 对象。`,
    }
  }

  const source = parsedValue as Record<string, unknown>
  const nextRecord: Record<string, string> = {}

  for (const [rawKey, rawValue] of Object.entries(source)) {
    const key = rawKey.trim()
    if (!key)
      continue

    if (typeof rawValue !== 'string') {
      return {
        ok: false,
        error: `${label} 的键 \`${key}\` 仅支持字符串值。`,
      }
    }

    const value = rawValue.trim()
    if (!value)
      continue

    nextRecord[key] = value
  }

  if (Object.keys(nextRecord).length === 0)
    return { ok: true, value: undefined }

  return { ok: true, value: nextRecord }
}

function parseTemplateJson(
  sourceText: string,
  label: string,
): { ok: true, value: unknown } | { ok: false, error: string } {
  const normalized = sourceText.trim()
  if (!normalized)
    return { ok: true, value: undefined }

  try {
    return {
      ok: true,
      value: JSON.parse(normalized),
    }
  }
  catch (error) {
    return {
      ok: false,
      error: `${label} JSON 解析失败：${toErrorMessage(error)}`,
    }
  }
}

function stringifyJsonTemplate(input: unknown) {
  if (input === undefined)
    return ''

  try {
    return JSON.stringify(input, null, 2)
  }
  catch {
    return ''
  }
}

function clearTemplateValidationErrors() {
  templateValidationErrors.value = []
}

function getEndpointNode(section: DictKeeperCrudSection, action: EndpointActionKey) {
  if (section === 'dictionary')
    return form.dictionary[action]

  return form.item[action]
}

function updateEndpointTimeout(node: DictKeeperCrudEndpointNode, event: Event) {
  const target = event.target as HTMLInputElement
  const value = target.value.trim()

  if (!value) {
    node.timeoutMs = undefined
    return
  }

  const parsedValue = Number.parseInt(value, 10)
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    node.timeoutMs = undefined
    return
  }

  node.timeoutMs = parsedValue
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error)
    return error.message

  return '未知错误'
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
        填写接口基础路径与 8 个 CRUD 接口（每个接口均需配置地址与请求方式）。高级面板可为每个 endpoint 单独配置 path/query/header/body 模板、content-type、timeout 与参数合并策略。
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
                {{ externalCrud.name }}{{ externalCrud.isDefault ? '（默认）' : '' }} · {{ formatTimestamp(externalCrud.updatedAt) }}
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

      <div v-if="allValidationErrors.length > 0" class="dict-external-crud-validation">
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
          <li v-for="error in allValidationErrors" :key="error">
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
                :id="activeKey === 'dictionary' ? 'dict-tab-panel-dictionary' : 'dict-tab-panel-item'"
                class="dict-external-crud-tab-panel"
                role="tabpanel"
                :aria-labelledby="activeKey === 'dictionary' ? 'dict-tab-dictionary' : 'dict-tab-item'"
              >
                <h4 class="dict-external-crud-subtitle">
                  {{ activeKey === 'dictionary' ? '数据字典 CRUD 接口' : '字典项 CRUD 接口' }}
                </h4>

                <p class="dict-external-crud-template-tip">
                  高级模板占位符支持：<code v-pre>{{payload.xxx}}</code>、<code v-pre>{{auth.xxx}}</code>、<code v-pre>{{context.xxx}}</code>
                </p>

                <div class="dict-external-crud-grid dict-external-crud-grid--single">
                  <label
                    v-for="endpoint in endpointRowsByTab"
                    :key="`${endpoint.section}-${endpoint.key}`"
                    class="dict-external-crud-field"
                  >
                    <span>{{ endpoint.label }}</span>
                    <div class="dict-external-crud-endpoint-control">
                      <input v-model="endpoint.node.path" type="text" :placeholder="endpoint.placeholder">
                      <select v-model="endpoint.node.method">
                        <option value="">
                          请选择请求方式
                        </option>
                        <option v-for="method in requestMethodOptions" :key="`${endpoint.section}-${endpoint.key}-${method}`" :value="method">
                          {{ method }}
                        </option>
                      </select>
                    </div>

                    <details class="dict-external-crud-advanced-panel">
                      <summary>高级参数模板配置</summary>

                      <div class="dict-external-crud-advanced-grid">
                        <label class="dict-external-crud-field">
                          <span>Path Template（可选）</span>
                          <input
                            v-model="endpoint.node.pathTemplate"
                            type="text"
                            placeholder="例如 /dict/{{payload.dictId}}/item"
                          >
                        </label>

                        <label class="dict-external-crud-field">
                          <span>Content-Type（可选）</span>
                          <select v-model="endpoint.node.contentType">
                            <option
                              v-for="option in CONTENT_TYPE_OPTIONS"
                              :key="`${endpoint.section}-${endpoint.key}-content-type-${option.value || 'auto'}`"
                              :value="option.value"
                            >
                              {{ option.label }}
                            </option>
                          </select>
                        </label>

                        <label class="dict-external-crud-field">
                          <span>参数合并策略（可选）</span>
                          <select v-model="endpoint.node.mergeStrategy">
                            <option value="">
                              默认（auth-overrides）
                            </option>
                            <option
                              v-for="strategy in endpointMergeStrategyOptions"
                              :key="`${endpoint.section}-${endpoint.key}-merge-${strategy}`"
                              :value="strategy"
                            >
                              {{ ENDPOINT_MERGE_STRATEGY_LABELS[strategy] ?? strategy }}
                            </option>
                          </select>
                        </label>

                        <label class="dict-external-crud-field">
                          <span>Timeout（毫秒，可选）</span>
                          <input
                            :value="endpoint.node.timeoutMs ?? ''"
                            type="number"
                            min="1"
                            step="1"
                            placeholder="例如 15000"
                            @input="updateEndpointTimeout(endpoint.node, $event)"
                          >
                        </label>

                        <label class="dict-external-crud-field dict-external-crud-field--full">
                          <span>Query Template（JSON 对象）</span>
                          <textarea
                            v-model="endpoint.draft.queryTemplateText"
                            rows="4"
                            placeholder="例如：{&quot;dictId&quot;:&quot;{{payload.dictId}}&quot;}"
                          />
                        </label>

                        <label class="dict-external-crud-field dict-external-crud-field--full">
                          <span>Header Template（JSON 对象）</span>
                          <textarea
                            v-model="endpoint.draft.headerTemplateText"
                            rows="4"
                            placeholder="例如：{&quot;Authorization&quot;:&quot;Bearer {{auth.token}}&quot;}"
                          />
                        </label>

                        <label class="dict-external-crud-field dict-external-crud-field--full">
                          <span>Body Template（JSON）</span>
                          <textarea
                            v-model="endpoint.draft.bodyTemplateText"
                            rows="6"
                            placeholder="例如：{&quot;id&quot;:&quot;{{payload.id}}&quot;,&quot;operator&quot;:&quot;{{context.page}}&quot;}"
                          />
                        </label>
                      </div>
                    </details>
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

.dict-external-crud-template-tip {
  margin: 0;
  border: 1px dashed rgb(125 211 252 / 0.75);
  border-radius: 0.65rem;
  background: rgb(240 249 255 / 0.88);
  padding: 0.55rem 0.7rem;
  font-size: 0.72rem;
  line-height: 1.35;
  color: rgb(12 74 110 / 0.9);

  code {
    border-radius: 0.35rem;
    background: rgb(226 232 240 / 0.75);
    padding: 0.08rem 0.3rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
    font-size: 0.68rem;
  }
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

  :is(input, select, textarea) {
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

  :is(input, select, textarea):focus {
    border-color: rgb(13 148 136 / 0.95);
  }

  textarea {
    resize: vertical;
    min-height: 4.5rem;
    line-height: 1.35rem;
  }
}

.dict-external-crud-field--full {
  grid-column: 1 / -1;
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

.dict-external-crud-advanced-panel {
  margin-top: 0.25rem;
  border: 1px dashed rgb(148 163 184 / 0.6);
  border-radius: 0.65rem;
  background: rgb(248 250 252 / 0.72);
  padding: 0.55rem 0.65rem;

  summary {
    cursor: pointer;
    font-size: 0.72rem;
    color: rgb(51 65 85 / 0.95);
    user-select: none;
  }
}

.dict-external-crud-advanced-grid {
  margin-top: 0.75rem;
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 0.7rem;
}

@media (width >= 960px) {
  .dict-external-crud-advanced-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
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
