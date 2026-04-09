<script lang="ts" setup>
const {
  width = 'min(92vw, 35vw)',
  hasBackdrop = true,
  closeOnBackdrop = true,
  zIndex = 60,
} = defineProps<{
  width?: string
  hasBackdrop?: boolean
  closeOnBackdrop?: boolean
  zIndex?: number
}>()

const open = defineModel<boolean>('open', { default: false })

const drawerStyle = computed(() => ({
  width,
  zIndex: `${zIndex + 1}`,
}))

const backdropStyle = computed(() => ({ zIndex: `${zIndex}` }))

function closeDrawer() {
  open.value = false
}

function handleBackdropClick() {
  if (!closeOnBackdrop)
    return
  closeDrawer()
}
</script>

<template>
  <Transition name="dict-drawer-fade">
    <div
      v-if="open && hasBackdrop"
      class="dict-drawer-backdrop"
      :style="backdropStyle"
      @click="handleBackdropClick"
    />
  </Transition>

  <Transition name="dict-drawer-slide">
    <aside
      v-if="open"
      class="dict-drawer-panel"
      :style="drawerStyle"
      flex="~ col"
      border="l-1 solid #06b6d4/16"
      bg="#f8fafc"
      shadow="-2xl #0f172a/8"
      role="dialog"
      aria-modal="true"
    >
      <header p="x-4 y-3" border="b-1 solid #06b6d4/14" flex="~" items="center" justify="between">
        <slot name="header">
          <span text="sm semibold #0f172a/85">抽屉</span>
        </slot>

        <button
          type="button"
          class="icon-btn"
          p="1"
          rounded="full"
          aria-label="close drawer"
          @click="closeDrawer"
        >
          <span i-mdi:close text="5 #0f172a/70" />
        </button>
      </header>

      <section flex="1" min-h="0" overflow="auto" p="4">
        <slot>
          <p text="sm #64748b">
            抽屉内容区域
          </p>
        </slot>
      </section>

      <footer v-if="$slots.footer" p="4" border="t-1 solid #06b6d4/12">
        <slot name="footer" />
      </footer>
    </aside>
  </Transition>
</template>

<style lang="scss" scoped>
.dict-drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgb(15 23 42 / 24%);
  backdrop-filter: blur(1px);
}

.dict-drawer-panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
}

.dict-drawer-fade-enter-active,
.dict-drawer-fade-leave-active {
  transition: opacity 0.2s ease;
}

.dict-drawer-fade-enter-from,
.dict-drawer-fade-leave-to {
  opacity: 0;
}

.dict-drawer-slide-enter-active,
.dict-drawer-slide-leave-active {
  transition: transform 0.22s ease, opacity 0.22s ease;
}

.dict-drawer-slide-enter-from,
.dict-drawer-slide-leave-to {
  transform: translateX(100%);
  opacity: 0.98;
}
</style>
