import {
  deleteImportPipelineConfigById,
  getImportPipelineConfigById,
  listImportPipelineConfigs,
  saveImportPipelineConfig,
} from '../services/import_pipeline_configs.service'
import type { SavedImportPipelineConfig } from '~/import-pipeline/types'
import { readBody } from '~/utils/define-event-handler.util'

interface ConfigIdPayload {
  id?: string
}

export class ImportPipelineConfigsController {
  async listImportPipelineConfigs(): Promise<SavedImportPipelineConfig[]> {
    return await listImportPipelineConfigs()
  }

  async getImportPipelineConfig(event: unknown): Promise<SavedImportPipelineConfig | null> {
    const body = readBody<ConfigIdPayload>(event)
    const id = body?.id
    if (typeof id !== 'string' || !id.trim())
      throw new Error('id is required')

    return await getImportPipelineConfigById(id)
  }

  async saveImportPipelineConfig(event: unknown): Promise<SavedImportPipelineConfig> {
    return await saveImportPipelineConfig(readBody(event))
  }

  async deleteImportPipelineConfig(event: unknown): Promise<boolean> {
    const body = readBody<ConfigIdPayload>(event)
    const id = body?.id
    if (typeof id !== 'string' || !id.trim())
      throw new Error('id is required')

    await deleteImportPipelineConfigById(id)
    return true
  }
}
