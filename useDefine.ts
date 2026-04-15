import process from 'node:process'
import packageJson from './package.json'

const isDev = process.env.NODE_ENV !== 'production'

const useDefine = {
  __DEV__: isDev,
  __NAME__: JSON.stringify(packageJson.name),
  // 'process.env.NODE_ENV': JSON.stringify(isDev ? 'development' : 'production'),

  __PORT__: Number(process.env.PORT) ?? 5173,
}

export { useDefine }
export default useDefine
