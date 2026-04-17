import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export type WriteResult = 'created' | 'updated' | 'unchanged'

export async function writeIfChanged(
  filePath: string,
  content: string,
): Promise<WriteResult> {
  await mkdir(dirname(filePath), { recursive: true })

  let existed = true

  try {
    const current = await readFile(filePath, 'utf8')
    if (current === content)
      return 'unchanged'
  }
  catch {
    existed = false
  }

  await writeFile(filePath, content, 'utf8')
  return existed ? 'updated' : 'created'
}
