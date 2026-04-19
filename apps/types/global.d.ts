declare const __DEV__: boolean
/** Extension name, defined in packageJson.name */
declare const __NAME__: string
/** App root id, can be overridden by APP_NAME */
declare const __APP_NAME__: string

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}
