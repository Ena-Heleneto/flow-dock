import { useWebExtensionStorage } from '~/shared/composables/useWebExtensionStorage'

export const { data: storageDemo, dataReady: storageDemoReady } = useWebExtensionStorage('webext-demo', 'Storage Demo')
