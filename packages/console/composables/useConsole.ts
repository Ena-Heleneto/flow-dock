export function useConsole() {
  const count = reactive({ all: 100, info: 100, warn: 100, error: 100, debug: 100 })

  const list = ref([])
  return { count, list }
}
