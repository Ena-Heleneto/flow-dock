import process from 'node:process'
import packageJson from './package.json'

const isDev = process.env.NODE_ENV !== 'production'
const resolvedPort = Number(process.env.PORT || '') || 5173
const rawAppName = process.env.APP_NAME?.trim()
const appRootId = rawAppName && rawAppName.length > 0
  ? rawAppName.replace(/^#/, '')
  : 'flow-dock-app'

const useDefine = {
  '__DEV__': isDev,
  '__NAME__': JSON.stringify(packageJson.name),
  '__PORT__': resolvedPort,
  '__APP_NAME__': JSON.stringify(appRootId),
  'import.meta.env.__APP_NAME__': JSON.stringify(appRootId),
}

export { useDefine }
export default useDefine
