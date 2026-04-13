import type { ProtocolWithReturn } from 'webext-bridge'
import type {
  RouterRequestPayload,
  RouterResponse,
} from '@/runtime/types'
import type {
  RequestRecorderMarkPendingProcessedInput,
  RequestRecorderMarkPendingProcessedResponse,
  RequestRecorderReadPendingResponse,
  RequestRecorderSavePendingInput,
  RequestRecorderSavePendingResponse,
} from '~/shared/logic/request-recorder'

declare module 'webext-bridge' {
  export interface ProtocolMap {
    // define message protocol types
    // see https://github.com/antfu/webext-bridge#type-safe-protocols
    'tab-prev': { title: string | undefined }
    'get-current-tab': ProtocolWithReturn<{ tabId: number }, { title?: string }>
    'router-request': ProtocolWithReturn<RouterRequestPayload, RouterResponse>
    'request-recorder-save-pending': ProtocolWithReturn<RequestRecorderSavePendingInput, RequestRecorderSavePendingResponse>
    'request-recorder-read-pending': ProtocolWithReturn<Record<string, never>, RequestRecorderReadPendingResponse>
    'request-recorder-mark-pending-processed': ProtocolWithReturn<RequestRecorderMarkPendingProcessedInput, RequestRecorderMarkPendingProcessedResponse>
  }
}
