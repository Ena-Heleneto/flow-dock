import { createApp } from 'vue'
import { setupApp } from '~/logic/common-setup'
import App from './navigation.vue'
import '~/styles'

const node = `#${__APP_NAME__}`

const app = createApp(App)
setupApp(app)
app.mount(node)
