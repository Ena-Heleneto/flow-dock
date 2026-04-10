<script setup lang="ts">
import { request } from '~/shared/composables/useRouterRequest'

const documents = ref<Array<any>>([])
const selectedDocument = ref<any | null>(null)
const items = ref<Array<any>>([])

const newDocTitle = ref('')
const loading = ref(false)
const responseText = ref('')

async function loadDocuments() {
  loading.value = true
  try {
    const res = await request<{ items?: any[] }>('/database-manager/document.read', {
      method: 'GET',
      meta: { module: 'database-manager', page: 'database-manager' },
    })
    documents.value = res.ok ? (res.data.items ?? []) : []
  }
  finally {
    loading.value = false
  }
}

async function createDocument() {
  if (!newDocTitle.value)
    return
  loading.value = true
  try {
    const res = await request('/database-manager/document.create', {
      method: 'POST',
      body: { title: newDocTitle.value },
      meta: { module: 'database-manager', page: 'database-manager' },
    })
    responseText.value = JSON.stringify(res, null, 2)
    newDocTitle.value = ''
    await loadDocuments()
  }
  finally { loading.value = false }
}

async function selectDocument(doc: any) {
  selectedDocument.value = doc
  await loadItems()
}

async function deleteDocument(doc: any) {
  const confirmed = await showConfirmDialog('Delete document?')
  if (!confirmed)
    return
  loading.value = true
  try {
    const res = await request('/database-manager/document.delete', {
      method: 'DELETE',
      body: { id: doc._id },
      meta: { module: 'database-manager', page: 'database-manager' },
    })
    responseText.value = JSON.stringify(res, null, 2)
    selectedDocument.value = null
    await loadDocuments()
  }
  finally { loading.value = false }
}

// items
const newItemData = ref('')

async function loadItems() {
  if (!selectedDocument.value) {
    items.value = []
    return
  }
  loading.value = true
  try {
    const res = await request<{ items?: any[] }>('/database-manager/item.list', {
      method: 'GET',
      body: { documentId: selectedDocument.value._id },
      meta: { module: 'database-manager', page: 'database-manager' },
    })
    items.value = res.ok ? (res.data.items ?? []) : []
  }
  finally { loading.value = false }
}

async function createItem() {
  if (!selectedDocument.value)
    return
  loading.value = true
  try {
    const res = await request('/database-manager/item.create', {
      method: 'POST',
      body: { documentId: selectedDocument.value._id, data: { text: newItemData.value } },
      meta: { module: 'database-manager', page: 'database-manager' },
    })
    responseText.value = JSON.stringify(res, null, 2)
    newItemData.value = ''
    await loadItems()
  }
  finally { loading.value = false }
}

async function updateItem(item: any) {
  const newVal = await showInputDialog('Edit item data JSON', JSON.stringify(item.data))
  if (newVal === null)
    return
  let parsed: unknown
  try {
    parsed = JSON.parse(newVal)
  }
  catch {
    parsed = newVal
  }
  loading.value = true
  try {
    const res = await request('/database-manager/item.update', {
      method: 'PUT',
      body: { id: item._id, data: parsed },
      meta: { module: 'database-manager', page: 'database-manager' },
    })
    responseText.value = JSON.stringify(res, null, 2)
    await loadItems()
  }
  finally { loading.value = false }
}

async function deleteItem(item: any) {
  const confirmed = await showConfirmDialog('Delete item?')
  if (!confirmed)
    return
  loading.value = true
  try {
    const res = await request('/database-manager/item.delete', {
      method: 'DELETE',
      body: { id: item._id },
      meta: { module: 'database-manager', page: 'database-manager' },
    })
    responseText.value = JSON.stringify(res, null, 2)
    await loadItems()
  }
  finally { loading.value = false }
}

onMounted(() => {
  loadDocuments()
})

// dialog helpers (module scope)
function showInputDialog(title: string, initial = ''): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.style.position = 'fixed'
    overlay.style.inset = '0'
    overlay.style.background = 'rgba(0,0,0,0.4)'
    overlay.style.display = 'flex'
    overlay.style.alignItems = 'center'
    overlay.style.justifyContent = 'center'
    overlay.style.zIndex = '9999'

    const box = document.createElement('div')
    box.style.background = 'white'
    box.style.padding = '12px'
    box.style.borderRadius = '8px'
    box.style.minWidth = '320px'

    const label = document.createElement('div')
    label.textContent = title
    label.style.marginBottom = '8px'

    const input = document.createElement('textarea')
    input.value = initial
    input.style.width = '100%'
    input.style.height = '120px'
    input.style.marginBottom = '8px'

    const actions = document.createElement('div')
    actions.style.display = 'flex'
    actions.style.justifyContent = 'flex-end'
    actions.style.gap = '8px'

    const cancelBtn = document.createElement('button')
    cancelBtn.textContent = 'Cancel'
    const okBtn = document.createElement('button')
    okBtn.textContent = 'OK'
    okBtn.style.background = '#0ea5e9'
    okBtn.style.color = 'white'
    okBtn.style.border = 'none'
    okBtn.style.padding = '6px 10px'

    actions.appendChild(cancelBtn)
    actions.appendChild(okBtn)
    box.appendChild(label)
    box.appendChild(input)
    box.appendChild(actions)
    overlay.appendChild(box)
    document.body.appendChild(overlay)

    cancelBtn.onclick = () => {
      document.body.removeChild(overlay)
      resolve(null)
    }
    okBtn.onclick = () => {
      const val = input.value
      document.body.removeChild(overlay)
      resolve(val)
    }
  })
}

function showConfirmDialog(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.style.position = 'fixed'
    overlay.style.inset = '0'
    overlay.style.background = 'rgba(0,0,0,0.4)'
    overlay.style.display = 'flex'
    overlay.style.alignItems = 'center'
    overlay.style.justifyContent = 'center'
    overlay.style.zIndex = '9999'

    const box = document.createElement('div')
    box.style.background = 'white'
    box.style.padding = '12px'
    box.style.borderRadius = '8px'
    box.style.minWidth = '240px'

    const label = document.createElement('div')
    label.textContent = message
    label.style.marginBottom = '8px'

    const actions = document.createElement('div')
    actions.style.display = 'flex'
    actions.style.justifyContent = 'flex-end'
    actions.style.gap = '8px'

    const cancelBtn = document.createElement('button')
    cancelBtn.textContent = 'Cancel'
    const okBtn = document.createElement('button')
    okBtn.textContent = 'OK'
    okBtn.style.background = '#ef4444'
    okBtn.style.color = 'white'
    okBtn.style.border = 'none'
    okBtn.style.padding = '6px 10px'

    actions.appendChild(cancelBtn)
    actions.appendChild(okBtn)
    box.appendChild(label)
    box.appendChild(actions)
    overlay.appendChild(box)
    document.body.appendChild(overlay)

    cancelBtn.onclick = () => {
      document.body.removeChild(overlay)
      resolve(false)
    }
    okBtn.onclick = () => {
      document.body.removeChild(overlay)
      resolve(true)
    }
  })
}
</script>

<template>
  <main class="mx-auto w-full max-w-4xl p-4 text-slate-800">
    <h1 class="text-lg font-semibold">
      Database Manager (Documents & Items)
    </h1>

    <div class="mt-4 grid grid-cols-3 gap-4">
      <section class="col-span-1 rounded border bg-white p-3">
        <h2 class="font-medium">
          Documents
        </h2>
        <div class="mt-2 flex gap-2">
          <input v-model="newDocTitle" class="flex-1 rounded border px-2 py-1" placeholder="New document title">
          <button class="rounded bg-blue-600 text-white px-3" :disabled="loading" @click="createDocument">
            Create
          </button>
        </div>
        <ul class="mt-3 space-y-2 max-h-64 overflow-auto text-sm">
          <li v-for="doc in documents" :key="doc._id" class="flex justify-between items-center">
            <button class="text-left flex-1" @click="selectDocument(doc)">
              {{ doc.title || doc._id }}
            </button>
            <button class="ml-2 text-xs text-red-600" @click="deleteDocument(doc)">
              Delete
            </button>
          </li>
        </ul>
      </section>

      <section class="col-span-2 rounded border bg-white p-3">
        <h2 class="font-medium">
          Document Details
        </h2>
        <div v-if="!selectedDocument" class="mt-3 text-sm text-slate-500">
          Select a document to view items.
        </div>
        <div v-else class="mt-3">
          <div class="mb-2 text-sm">
            ID: {{ selectedDocument._id }}
          </div>
          <div class="mb-2 text-sm">
            Title: {{ selectedDocument.title }}
          </div>

          <div class="mt-2">
            <h3 class="font-medium">
              Items
            </h3>
            <div class="mt-2 flex gap-2">
              <input v-model="newItemData" class="flex-1 rounded border px-2 py-1" placeholder="New item text">
              <button class="rounded bg-green-600 text-white px-3" :disabled="loading" @click="createItem">
                Add
              </button>
            </div>

            <ul class="mt-3 space-y-2 max-h-64 overflow-auto text-sm">
              <li v-for="item in items" :key="item._id" class="flex justify-between items-start">
                <div class="flex-1">
                  {{ item.data }}
                </div>
                <div class="ml-2 flex gap-2">
                  <button class="text-xs" @click="updateItem(item)">
                    Edit
                  </button>
                  <button class="text-xs text-red-600" @click="deleteItem(item)">
                    Delete
                  </button>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>

    <section class="mt-4 rounded border bg-slate-50 p-3">
      <h2 class="mb-2 text-sm font-semibold">
        Response
      </h2>
      <pre class="max-h-80 overflow-auto text-xs leading-5">{{ responseText || '操作结果将在此显示' }}</pre>
    </section>
  </main>
</template>
