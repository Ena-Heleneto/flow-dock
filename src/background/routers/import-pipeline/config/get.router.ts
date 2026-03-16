import { getImportPipelineConfigById } from '~/background/services/import_pipeline_configs.service'
import { defineEventHandler, readBody } from '~/utils/define-event-handler.util'

interface ConfigIdPayload {
  id?: string
}

export default defineEventHandler(async (event: unknown) => {
  const body = readBody<ConfigIdPayload>(event)
  const id = body?.id
  if (typeof id !== 'string' || !id.trim())
    throw new Error('id is required')

  return await getImportPipelineConfigById(id)
})
