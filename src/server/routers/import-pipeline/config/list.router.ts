import { listImportPipelineConfigs } from '~/server/services/import_pipeline_configs.service'
import { defineEventHandler } from '~/utils/define-event-handler.util'

export default defineEventHandler(async () => {
  return await listImportPipelineConfigs()
})
