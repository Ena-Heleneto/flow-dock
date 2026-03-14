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
} = useImportPipeline()
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
          v-model:headers-text="headersText"
          v-model:fixed-params-text="fixedParamsText"
          v-model:dynamic-params-text="dynamicParamsText"
          v-model:wrapper-key="wrapperKey"
          :request-mode="requestMode"
          :cookie-diagnostic="cookieDiagnostic"
          :result="result"
          :running-batch="runningBatch"
          :total-batch="totalBatch"
        />

        <section class="grid gap-4 md:grid-cols-2">
          <PipelineInputPanel
            v-model:input-text="inputText"
            :parse-error="parseError"
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
  </main>
</template>
