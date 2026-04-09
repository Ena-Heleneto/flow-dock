<script lang="ts" setup>
import ConsoleContent from './content.vue'
import ConsoleFooter from './footer.vue'
import ConsoleHeader from './header.vue'
</script>

<template>
  <div h="50" flex="~ col" border-t="1 solid #ced6e0" w="full">
    <ConsoleHeader />
    <ConsoleContent />
    <ConsoleFooter />
  </div>
</template>
