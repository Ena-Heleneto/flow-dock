export function useDictKeeper() {
  const list = ref([])
  const count = ref(0)
  return { list, count }
}
