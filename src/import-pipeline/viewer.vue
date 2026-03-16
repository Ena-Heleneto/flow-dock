<script setup lang="ts">
import PipelineBaseConfig from './components/PipelineBaseConfig.vue'
import PipelineHeader from './components/PipelineHeader.vue'
import PipelineInputPanel from './components/PipelineInputPanel.vue'
import PipelineLogPanel from './components/PipelineLogPanel.vue'
import PipelinePreviewPanel from './components/PipelinePreviewPanel.vue'
import PipelineSidebar from './components/PipelineSidebar.vue'
import { useImportPipeline } from './composables/useImportPipeline'

const {
  endpoint,
  method,
  batchSize,
  requestMode,
  wrapperKey,
  autoExtractObjectField,
  headersText,
  fixedParamsText,
  dynamicParamsText,
  inputText,
  parsedItems,
  parseError,
  isImporting,
  previewIndex,
  runStatus,
  runningBatch,
  totalBatch,
  result,
  logs,
  canRun,
  previewItems,
  mergedPreviewError,
  mergedPreviewText,
  statusTone,
  statusText,
  cookieDiagnostic,
  parseInput,
  handleFileChange,
  runPipeline,
  requestStop,
  resetPipeline,
  savedConfigs,
  selectedConfigId,
  configNameInput,
  saveCurrentConfig,
  loadSavedConfig,
  createConfigFromCurrent,
  deleteSelectedConfig,
} = useImportPipeline()

async function handleSaveConfig() {
  await saveCurrentConfig()
}

async function handleLoadConfig() {
  await loadSavedConfig()
}

async function handleCreateConfig() {
  await createConfigFromCurrent()
}

async function handleDeleteConfig() {
  await deleteSelectedConfig()
}
</script>

<template>
  <main class="relative min-h-screen overflow-hidden bg-gradient-to-br from-teal-50 via-cyan-50 to-slate-100 px-4 py-5 text-slate-800 sm:px-6 lg:px-8">
    <div class="pointer-events-none absolute inset-0 opacity-35" style="background-image: radial-gradient(circle at 1px 1px, rgba(15, 23, 42, 0.12) 1px, transparent 0); background-size: 20px 20px;" />

    <section class="relative mx-auto max-w-7xl rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-xl backdrop-blur-sm sm:p-6">
      <PipelineHeader
        :can-run="canRun"
        :run-status="runStatus"
        :status-tone="statusTone"
        :status-text="statusText"
        @run="runPipeline"
        @stop="requestStop"
        @reset="resetPipeline"
      />

      <PipelineBaseConfig
        v-model:endpoint="endpoint"
        v-model:method="method"
        v-model:batch-size="batchSize"
        v-model:auto-extract-object-field="autoExtractObjectField"
        v-model:request-mode="requestMode"
      />

      <div class="grid gap-4 lg:grid-cols-[320px_1fr]">
        <PipelineSidebar
          v-model:selected-config-id="selectedConfigId"
          v-model:config-name-input="configNameInput"
          v-model:headers-text="headersText"
          v-model:fixed-params-text="fixedParamsText"
          v-model:dynamic-params-text="dynamicParamsText"
          v-model:wrapper-key="wrapperKey"
          :saved-configs="savedConfigs"
          :request-mode="requestMode"
          :cookie-diagnostic="cookieDiagnostic"
          :result="result"
          :running-batch="runningBatch"
          :total-batch="totalBatch"
          @load-config="handleLoadConfig"
          @save-config="handleSaveConfig"
          @create-config="handleCreateConfig"
          @delete-config="handleDeleteConfig"
        />

        <section class="grid gap-4 md:grid-cols-2">
          <PipelineInputPanel
            v-model:input-text="inputText"
            :parse-error="parseError"
            :is-importing="isImporting"
            :preview-items="previewItems"
            @parse-input="parseInput"
            @file-change="handleFileChange"
          />

          <PipelineLogPanel :logs="logs" />

          <PipelinePreviewPanel
            v-model:preview-index="previewIndex"
            :parsed-count="parsedItems.length"
            :merged-preview-error="mergedPreviewError"
            :merged-preview-text="mergedPreviewText"
          />
        </section>
      </div>
    </section>

    <div
      v-if="isImporting"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-[1.5px]"
    >
      <div class="flex items-center gap-3 rounded-xl border border-teal-200 bg-white px-4 py-3 text-sm text-teal-700 shadow-xl">
        <span class="h-4 w-4 animate-spin rounded-full border-2 border-teal-500 border-r-transparent" />
        <span>正在解析导入文件，请稍候...</span>
      </div>
    </div>
  </main>
</template>
