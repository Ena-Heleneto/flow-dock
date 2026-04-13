<script lang="ts" setup>
import DictKeeperModal from '~/dict-keeper/components/modal/index.vue'
import {
  DICT_KEEPER_AUTH_ACTION_OPTIONS,
  DICT_KEEPER_AUTH_INJECT_TARGET_OPTIONS,
  DICT_KEEPER_AUTH_SECTION_OPTIONS,
  useDictKeeperAuthConfig,
} from '~/dict-keeper/composables/useDictKeeperAuthConfig'
import { useDictKeeperExternalCrud } from '~/dict-keeper/composables/useDictKeeperExternalCrud'

const modalOpen = defineModel<boolean>('visible', { default: false })

const authConfigStore = useDictKeeperAuthConfig()
const externalCrudStore = useDictKeeperExternalCrud()

const {
  authJsonText,
  injectTarget,
  successFieldPath,
  successExpectedValueText,
  section,
  action,
  payloadJsonText,
  validationErrors,
  noticeText,
  noticeClass,
  currentSummary,
} = authConfigStore.state

const {
  resetConfig,
  buildExecuteInput,
  setExecutionSuccessNotice,
  setExecutionErrorNotice,
} = authConfigStore.actions

const { executeExternalCrud } = externalCrudStore.actions

const injectTargetOptions = DICT_KEEPER_AUTH_INJECT_TARGET_OPTIONS
const sectionOptions = DICT_KEEPER_AUTH_SECTION_OPTIONS
const actionOptions = DICT_KEEPER_AUTH_ACTION_OPTIONS

const isExecuting = ref(false)
const lastExecution = ref<Awaited<ReturnType<typeof executeExternalCrud>> | null>(null)

const lastResponseBodyText = computed(() => {
  const target = lastExecution.value?.response.data
  if (target === undefined)
    return ''

  if (typeof target === 'string')
    return target

  try {
    return JSON.stringify(target, null, 2)
  }
  catch {
    return String(target)
  }
})

async function handleExecute() {
  const input = buildExecuteInput()
  if (!input) {
    lastExecution.value = null
    return
  }

  isExecuting.value = true
  lastExecution.value = null

  try {
    const result = await executeExternalCrud(input)
    if (!result) {
      setExecutionErrorNotice('执行失败，请检查响应码规则与鉴权参数。')
      return
    }

    lastExecution.value = result
    setExecutionSuccessNotice(result.status)
  }
  catch (error) {
    setExecutionErrorNotice(error instanceof Error ? error.message : '执行失败')
  }
  finally {
    isExecuting.value = false
  }
}

function handleReset() {
  resetConfig()
  lastExecution.value = null
}
</script>

<template>
  <DictKeeperModal
    v-model:open="modalOpen"
    title="鉴权数据配置"
    width="min(95vw, 760px)"
    max-height="min(90vh, 860px)"
  >
    <div class="dict-auth-config" flex="~ col" gap="4">
      <p class="dict-auth-config-tip">
        当前配置仅保存在页面会话内，刷新或重新进入页面会重置为空。可用它来临时注入鉴权数据并校验业务响应码。
      </p>

      <section class="dict-auth-config-section">
        <h3 class="dict-auth-config-title">
          鉴权数据 JSON
        </h3>

        <label class="dict-auth-config-field">
          <span>鉴权 JSON（对象）</span>
          <textarea
            v-model="authJsonText"
            rows="6"
            placeholder="例如：{&quot;Authorization&quot;:&quot;Bearer xxx&quot;,&quot;tenant&quot;:&quot;demo&quot;}"
          />
        </label>
      </section>

      <section class="dict-auth-config-section">
        <h3 class="dict-auth-config-title">
          注入策略与业务判定
        </h3>

        <div class="dict-auth-config-grid">
          <label class="dict-auth-config-field">
            <span>注入目标</span>
            <select v-model="injectTarget">
              <option
                v-for="option in injectTargetOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </label>

          <label class="dict-auth-config-field">
            <span>响应字段路径</span>
            <input
              v-model="successFieldPath"
              type="text"
              placeholder="如 code 或 data.code"
            >
          </label>

          <label class="dict-auth-config-field">
            <span>期望值（支持 JSON 字面量）</span>
            <input
              v-model="successExpectedValueText"
              type="text"
              placeholder="如 0 / true / &quot;OK&quot;"
            >
          </label>
        </div>
      </section>

      <section class="dict-auth-config-section">
        <div class="dict-auth-config-head">
          <h3 class="dict-auth-config-title">
            执行验证
          </h3>
          <span class="dict-auth-config-caption">当前策略：{{ currentSummary }}</span>
        </div>

        <div class="dict-auth-config-grid">
          <label class="dict-auth-config-field">
            <span>CRUD 分组</span>
            <select v-model="section">
              <option
                v-for="option in sectionOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </label>

          <label class="dict-auth-config-field">
            <span>CRUD 动作</span>
            <select v-model="action">
              <option
                v-for="option in actionOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </label>
        </div>

        <label class="dict-auth-config-field">
          <span>请求数据 JSON（可选）</span>
          <textarea
            v-model="payloadJsonText"
            rows="5"
            placeholder="例如：{&quot;id&quot;:&quot;123&quot;}"
          />
        </label>
      </section>

      <div v-if="noticeText" class="rounded-lg border px-3 py-2 text-xs" :class="noticeClass">
        {{ noticeText }}
      </div>

      <div v-if="validationErrors.length > 0" class="dict-auth-config-validation">
        <span class="dict-auth-config-validation-title">请先修正以下问题：</span>
        <ul class="dict-auth-config-validation-list">
          <li v-for="error in validationErrors" :key="error">
            • {{ error }}
          </li>
        </ul>
      </div>

      <section v-if="lastExecution" class="dict-auth-config-section">
        <h3 class="dict-auth-config-title">
          最近一次执行结果
        </h3>

        <div class="dict-auth-config-result-grid">
          <span>请求 URL：{{ lastExecution.url }}</span>
          <span>请求方法：{{ lastExecution.method }}</span>
          <span>注入目标：{{ lastExecution.injectTarget }}</span>
          <span>HTTP 状态：{{ lastExecution.status }} {{ lastExecution.statusText }}</span>
          <span>耗时：{{ lastExecution.durationMs }}ms</span>
          <span>业务判定：{{ lastExecution.business.enabled ? '已启用' : '未启用' }}</span>
        </div>

        <label class="dict-auth-config-field">
          <span>响应内容</span>
          <textarea :value="lastResponseBodyText" rows="10" readonly />
        </label>
      </section>
    </div>

    <template #footer>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="text-xs text-slate-500">鉴权配置仅在当前页面会话有效</span>

        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 transition hover:border-slate-400"
            @click="handleReset"
          >
            清空配置
          </button>

          <button
            type="button"
            class="rounded border border-cyan-600 bg-cyan-600 px-3 py-1.5 text-xs text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:border-cyan-400 disabled:bg-cyan-400"
            :disabled="isExecuting"
            @click="handleExecute"
          >
            {{ isExecuting ? '执行中...' : '执行验证' }}
          </button>
        </div>
      </div>
    </template>
  </DictKeeperModal>
</template>

<style lang="scss" scoped>
.dict-auth-config-tip {
  margin: 0;
  border: 1px solid rgb(14 116 144 / 18%);
  border-radius: 0.75rem;
  background: rgb(236 254 255 / 70%);
  padding: 0.8rem 0.9rem;
  font-size: 0.75rem;
  line-height: 1.4;
  color: rgb(8 47 73 / 0.9);
}

.dict-auth-config-section {
  border: 1px solid rgb(14 116 144 / 18%);
  border-radius: 0.75rem;
  background: rgb(248 250 252 / 92%);
  padding: 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.dict-auth-config-head {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.dict-auth-config-caption {
  font-size: 0.72rem;
  color: rgb(71 85 105 / 0.95);
}

.dict-auth-config-title {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 600;
  color: rgb(15 23 42 / 0.9);
}

.dict-auth-config-grid {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 0.875rem;
}

@media (width >= 860px) {
  .dict-auth-config-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.dict-auth-config-field {
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
    min-height: 5.5rem;
  }
}

.dict-auth-config-validation {
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

.dict-auth-config-validation-title {
  font-weight: 600;
}

.dict-auth-config-validation-list {
  margin: 0;
  padding-inline-start: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.dict-auth-config-result-grid {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 0.4rem;
  font-size: 0.75rem;
  color: rgb(51 65 85 / 0.95);
}

@media (width >= 860px) {
  .dict-auth-config-result-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
