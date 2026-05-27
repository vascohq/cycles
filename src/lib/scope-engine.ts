type OrderedItem = { id: string; order: number }

export function reorderScopes<T extends OrderedItem>(
  scopes: T[],
  activeId: string,
  overId: string
): T[] {
  const sorted = [...scopes].sort((a, b) => a.order - b.order)
  const fromIndex = sorted.findIndex((s) => s.id === activeId)
  const toIndex = sorted.findIndex((s) => s.id === overId)
  if (fromIndex === -1 || toIndex === -1) return scopes

  const [moved] = sorted.splice(fromIndex, 1)
  sorted.splice(toIndex, 0, moved)

  return sorted.map((s, i) => ({ ...s, order: i + 1 }))
}

export function taskCounts(
  tasks: { scopeId: string; done: boolean }[],
  scopeId: string
): { done: number; total: number } {
  const scopeTasks = tasks.filter((t) => t.scopeId === scopeId)
  return {
    done: scopeTasks.filter((t) => t.done).length,
    total: scopeTasks.length,
  }
}
