import type { JsonObject, RequestMode } from '../types'

export function useImportPipelineTemplate() {
  function parseJsonObject(text: string, label: string): JsonObject {
    const parsed = JSON.parse(text) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw new Error(`${label}必须是 JSON 对象。`)
    return parsed as JsonObject
  }

  function resolvePath(item: JsonObject, path: string): unknown {
    if (!path)
      return ''

    const segments = path.split('.').filter(Boolean)
    let cursor: unknown = item

    for (const segment of segments) {
      if (!cursor || typeof cursor !== 'object' || !(segment in (cursor as JsonObject)))
        return ''
      cursor = (cursor as JsonObject)[segment]
    }

    return cursor ?? ''
  }

  function renderTemplateString(template: string, item: JsonObject, index: number): string {
    return template.replace(/\{\{([^{}]+)\}\}/g, (_full, keyRaw: string) => {
      const key = keyRaw.trim()
      if (key === 'index')
        return String(index)
      if (key === 'index1')
        return String(index + 1)

      const path = key.startsWith('item.') ? key.slice(5) : key
      const value = resolvePath(item, path)
      return value == null ? '' : String(value)
    })
  }

  function applyDynamicTemplate(value: unknown, item: JsonObject, index: number): unknown {
    if (typeof value === 'string')
      return renderTemplateString(value, item, index)

    if (Array.isArray(value))
      return value.map(row => applyDynamicTemplate(row, item, index))

    if (value && typeof value === 'object') {
      const mapped: JsonObject = {}
      for (const [key, current] of Object.entries(value as JsonObject))
        mapped[key] = applyDynamicTemplate(current, item, index)
      return mapped
    }

    return value
  }

  function buildRequestBody(
    item: JsonObject,
    index: number,
    fixedParams: JsonObject,
    dynamicTemplate: JsonObject,
    requestMode: RequestMode,
    wrapperKey: string,
  ): JsonObject {
    const dynamicParams = applyDynamicTemplate(dynamicTemplate, item, index) as JsonObject
    const itemPayload = requestMode === 'wrapped-item'
      ? { [wrapperKey || 'data']: item }
      : item

    return {
      ...fixedParams,
      ...dynamicParams,
      ...itemPayload,
    }
  }

  return {
    parseJsonObject,
    buildRequestBody,
  }
}
