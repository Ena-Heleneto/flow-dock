<script lang="ts" setup>
const {
  title = '弹窗',
  width = 'min(92vw, 640px)',
  maxHeight = 'min(88vh, 720px)',
  hasBackdrop = true,
  closeOnBackdrop = true,
  showClose = true,
  zIndex = 70,
} = defineProps<{
  title?: string
  width?: string
  maxHeight?: string
  hasBackdrop?: boolean
  closeOnBackdrop?: boolean
  showClose?: boolean
  zIndex?: number
}>()

const open = defineModel<boolean>('open', { default: false })

const titleId = `dict-modal-title-${Math.random().toString(36).slice(2, 9)}`

const rootStyle = computed(() => ({ zIndex: `${zIndex}` }))
const shellStyle = computed(() => ({ zIndex: `${zIndex + 1}` }))
const panelStyle = computed(() => ({ width, maxHeight }))

function closeModal() {
  open.value = false
}

function handleBackdropClick() {
  if (!closeOnBackdrop)
    return
  closeModal()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="dict-modal-fade">
      <div v-if="open" fixed="~" inset="0" :style="rootStyle">
        <div
          v-if="hasBackdrop" inset="0" bg="#0f172a/28" backdrop-blur="xs" absolute="~"
          @click="handleBackdropClick"
        />

        <div
          absolute="~" inset="0" flex="~" items="center" justify="center" :style="shellStyle" p="4"
          @click.self="handleBackdropClick"
        >
          <section
            class="dict-modal-panel" relative="~" :style="panelStyle" flex="~ col" border="1 solid #06b6d4/16" bg="#f8fafc"
            shadow="2xl #0f172a/10" role="dialog" aria-modal="true" :aria-labelledby="titleId"
          >
            <header
              class="dict-modal-header" p="x-5 y-4" border="b-1 solid #06b6d4/14" flex="~" items="center"
              justify="between" gap="4"
            >
              <slot name="header" :close="closeModal" :title-id="titleId">
                <span :id="titleId" text="base semibold #0f172a/88">{{ title }}</span>
              </slot>

              <button
                v-if="showClose" type="button" class="icon-btn" p="1" rounded="full" aria-label="close modal"
                @click="closeModal"
              >
                <span i-mdi:close text="5 #0f172a/70" />
              </button>
            </header>

            <section class="dict-modal-body" flex="1" min-h="0" overflow="auto" p="5">
              <slot>
                <p text="sm #64748b">
                  弹窗内容区域
                </p>
              </slot>
            </section>

            <footer v-if="$slots.footer" class="dict-modal-footer" p="x-5 y-4" border="t-1 solid #06b6d4/12">
              <slot name="footer" :close="closeModal" />
            </footer>
          </section>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
.dict-modal-panel {
  width: min(92vw, 640px);
  max-width: min(calc(100vw - 2rem), 100%);
  max-height: calc(100vh - 2rem);
  border-radius: 1rem;
  overflow: hidden;
}

.dict-modal-body {
  overscroll-behavior: contain;
}

.dict-modal-fade-enter-active,
.dict-modal-fade-leave-active {
  transition: opacity 0.2s ease;

  .dict-modal-panel {
    transition: transform 0.22s ease, opacity 0.22s ease;
  }
}

.dict-modal-fade-enter-from,
.dict-modal-fade-leave-to {
  opacity: 0;

  .dict-modal-panel {
    transform: translateY(12px) scale(0.98);
    opacity: 0.98;
  }
}
</style>
