import { createFetch } from '@vueuse/core'
import defu from 'defu'

interface FlowDockFetchOptions { baseUrl: string }
export function useFlowDockFetch(option: FlowDockFetchOptions) {
  const _option = defu(option, { baseUrl: 'https://my-api.com' })

  const { baseUrl } = _option
  return createFetch({
    baseUrl,
    // options: {
    //   async beforeFetch({ options }) {
    //     const myToken = await getMyToken()
    //     options.headers.Authorization = `Bearer ${myToken}`

    //     return { options }
    //   },
    // },
    // fetchOptions: {
    //   mode: 'cors',
    // },
  })
}
