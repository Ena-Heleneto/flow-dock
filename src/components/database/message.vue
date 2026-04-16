<script setup lang="ts">
const { errorMessage, successMessage } = defineProps<{
  errorMessage: string
  successMessage: string
}>()
</script>

<template>
  <div v-if="errorMessage || successMessage" m="t-3 b-4" space="y-2">
    <div v-if="errorMessage" border="~ red-300/80 dark:red-700/70" rounded="lg" bg="red-50/80 dark:red-900/20" p="x-3 y-2" text="sm red-700 dark:red-200">
      {{ errorMessage }}
    </div>
    <div v-if="successMessage" border="~ green-300/80 dark:green-700/70" rounded="lg" bg="green-50/80 dark:green-900/20" p="x-3 y-2" text="sm green-700 dark:green-200">
      {{ successMessage }}
    </div>
  </div>
</template>
