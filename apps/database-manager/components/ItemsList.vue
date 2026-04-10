<script setup lang="ts">
interface DatabaseItemLite {
  _id: string
  data?: unknown
  [key: string]: unknown
}

interface Props {
  items: DatabaseItemLite[]
  formatItemData: (data: unknown) => string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'updateItem', item: DatabaseItemLite): void
  (e: 'deleteItem', item: DatabaseItemLite): void
}>()
</script>

<template>
  <ul flex="~ col" min-h="0" h="full" overflow="auto" gap="2" text="sm">
    <li
      v-for="item in props.items"
      :key="item._id"
      rounded="md"
      border="1 solid #e2e8f0"
      bg="white"
      p="x-3 y-2"
      flex="~"
      justify="between"
      items="start"
      gap="2"
    >
      <pre flex="1" m="0" whitespace="pre-wrap" break="all" text="xs" leading="5">{{ props.formatItemData(item.data) }}</pre>
      <div m="l-2" flex="~" gap="2">
        <button text="xs" @click="emit('updateItem', item)">
          Edit
        </button>
        <button text="xs red-600" @click="emit('deleteItem', item)">
          Delete
        </button>
      </div>
    </li>

    <li v-if="!props.items.length" text="sm slate-500" p="y-2 x-1">
      No items yet.
    </li>
  </ul>
</template>
