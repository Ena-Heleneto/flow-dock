import { read, utils } from 'xlsx'

function sanitizeRowKeys(row: Record<string, unknown>) {
  const normalized: Record<string, unknown> = {}

  for (const [rawKey, value] of Object.entries(row)) {
    const key = String(rawKey ?? '').trim()
    if (!key)
      continue
    normalized[key] = value
  }

  return normalized
}

export function useXls() {
  async function parseExcelFile(file: File) {
    const arrayBuffer = await file.arrayBuffer()
    const workbook = read(arrayBuffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]

    if (!sheetName)
      throw new Error('Excel 文件中没有可读取的工作表。')

    const sheet = workbook.Sheets[sheetName]
    const rows = utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: null,
      raw: false,
      blankrows: false,
    })

    if (!Array.isArray(rows) || rows.length === 0)
      return []

    return rows.map(row => sanitizeRowKeys(row))
  }

  return {
    parseExcelFile,
  }
}
