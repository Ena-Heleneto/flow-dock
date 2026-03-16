import { saveImportPipelineConfig } from '~/background/services/import_pipeline_configs.service'
import { defineEventHandler, readBody } from '~/utils/define-event-handler.util'

export default defineEventHandler(async (event: unknown) => {
  return await saveImportPipelineConfig(readBody(event))
})
