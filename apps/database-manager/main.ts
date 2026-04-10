import { createApp } from 'vue'
import { setupApp } from '~/shared/logic/common-setup'
import App from './database-manager.vue'
import '~/shared/styles'

const app = createApp(App)
setupApp(app)
app.mount('#app')
