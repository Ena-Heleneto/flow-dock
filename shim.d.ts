import type { ProtocolWithReturn } from 'webext-bridge'
import type { SavedImportPipelineConfig } from './src/import-pipeline/types'

declare module 'webext-bridge' {
  export interface ProtocolMap {
    // define message protocol types
    // see https://github.com/antfu/webext-bridge#type-safe-protocols
    'tab-prev': { title: string | undefined }
    'get-current-tab': ProtocolWithReturn<{ tabId: number }, { title?: string }>
    'save-page': ProtocolWithReturn<void, void>
    'list-import-pipeline-configs': ProtocolWithReturn<Record<string, never>, SavedImportPipelineConfig[]>
    'get-import-pipeline-config': ProtocolWithReturn<{ id: string }, SavedImportPipelineConfig | null>
    'save-import-pipeline-config': ProtocolWithReturn<SavedImportPipelineConfig, SavedImportPipelineConfig>
    'delete-import-pipeline-config': ProtocolWithReturn<{ id: string }, boolean>
  }
}
