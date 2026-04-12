<script lang="ts" setup>
import ConsoleContent from '~/shared/components/console/content.vue'
import ConsoleFooter from '~/shared/components/console/footer.vue'
import ConsoleHeader from '~/shared/components/console/header.vue'
</script>

<template>
  <div h="60" flex="~ col" border-t="1 solid #e2e8f0" w="full" bg="white">
    <ConsoleHeader />
    <ConsoleContent />
    <ConsoleFooter />
  </div>
</template>
