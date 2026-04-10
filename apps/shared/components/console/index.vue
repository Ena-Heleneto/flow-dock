<script lang="ts" setup>
import ConsoleContent from './content.vue'
import ConsoleFooter from './footer.vue'
import ConsoleHeader from './header.vue'
</script>

<template>
  <div h="60" flex="~ col" border-t="1 solid #e2e8f0" w="full" bg="white">
    <ConsoleHeader />
    <ConsoleContent />
    <ConsoleFooter />
  </div>
</template>
