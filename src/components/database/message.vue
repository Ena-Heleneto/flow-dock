<script setup lang="ts">
const { errorMessage, successMessage } = defineProps<{
  errorMessage: string
  successMessage: string
}>()
</script>

<template>
  <div v-if="errorMessage || successMessage" m="b-4">
    <div v-if="errorMessage" class="mt-3 text-sm text-red-600">
      {{ errorMessage }}
    </div>
    <div v-if="successMessage" class="mt-3 text-sm text-green-600">
      {{ successMessage }}
    </div>
  </div>
</template>
