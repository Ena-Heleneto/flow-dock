import { validateRecordAgainstSchema } from './define-schema-handler.util'
import type { SchemaRecordType } from '~/types/define-schema-handler.type'
import type { IdbRecordDefinition, IdbStoreDefinition } from '~/types/idb.type'

export interface BuildDocumentOptions<TSchema extends IdbStoreDefinition> {
  defaults?: Partial<SchemaRecordType<TSchema>> | (() => Partial<SchemaRecordType<TSchema>>)
  requiredFields?: string[]
  strict?: boolean
}

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isRecordDefinition(type: unknown): type is IdbRecordDefinition {
  return typeof type === 'object' && type !== null
}

function pickFieldsByDefinition(value: unknown, definition: IdbRecordDefinition): Record<string, unknown> {
  const source = isObjectLike(value) ? value : {}
  const result: Record<string, unknown> = {}

  for (const [fieldName, fieldDefinition] of Object.entries(definition)) {
    if (!(fieldName in source))
      continue

    const fieldValue = source[fieldName]
    if (fieldValue === undefined)
      continue

    if (isRecordDefinition(fieldDefinition.type) && isObjectLike(fieldValue)) {
      result[fieldName] = pickFieldsByDefinition(fieldValue, fieldDefinition.type)
      continue
    }

    result[fieldName] = fieldValue
  }

  return result
}

function hasValidRequiredValue(value: unknown) {
  if (value === undefined || value === null)
    return false

  if (typeof value === 'string')
    return value.trim().length > 0

  return true
}

export function buildDocument<TSchema extends IdbStoreDefinition>(
  schema: Pick<TSchema, 'name' | 'record'>,
  payload: Partial<SchemaRecordType<TSchema>> = {},
  options: BuildDocumentOptions<TSchema> = {},
): SchemaRecordType<TSchema> {
  const defaults = typeof options.defaults === 'function' ? options.defaults() : (options.defaults ?? {})
  const strict = options.strict ?? true

  const merged = {
    ...defaults,
    ...payload,
  } as Partial<SchemaRecordType<TSchema>>

  const document = strict && schema.record
    ? pickFieldsByDefinition(merged, schema.record)
    : merged

  if (schema.record?.id?.type === String) {
    const idValue = (document as Record<string, unknown>).id
    if (!hasValidRequiredValue(idValue))
      (document as Record<string, unknown>).id = createId()
  }

  validateRecordAgainstSchema(schema, document)

  for (const field of options.requiredFields ?? []) {
    const fieldValue = (document as Record<string, unknown>)[field]
    if (!hasValidRequiredValue(fieldValue))
      throw new Error(`Field "${String(field)}" is required for schema "${schema.name}"`)
  }

  return document as SchemaRecordType<TSchema>
}
