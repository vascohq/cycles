'use client'

import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ScopeCard, type ScopeCardProps } from './scope-card'

type ScopeGridItem = Omit<
  ScopeCardProps,
  'dragHandleProps' | 'isDragging' | 'onOpen' | 'onDelete'
>

type ScopeGridProps = {
  scopes: ScopeGridItem[]
  onReorder?: (activeId: string, overId: string) => void
  onOpenScope?: (scopeId: string) => void
  onDeleteScope?: (scopeId: string) => void
  readOnly?: boolean
}

function SortableScopeCard({
  scope,
  onOpen,
  onDelete,
}: {
  scope: ScopeGridItem
  onOpen?: () => void
  onDelete?: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: scope.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <ScopeCard
        {...scope}
        dragHandleProps={listeners}
        isDragging={isDragging}
        onOpen={onOpen}
        onDelete={onDelete}
      />
    </div>
  )
}

export function ScopeGrid({
  scopes,
  onReorder,
  onOpenScope,
  onDeleteScope,
  readOnly,
}: ScopeGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      onReorder?.(String(active.id), String(over.id))
    }
  }

  const sortedScopes = [...scopes].sort((a, b) => a.order - b.order)

  if (readOnly) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sortedScopes.map((scope) => (
          <ScopeCard
            key={scope.id}
            {...scope}
            readOnly
            onOpen={onOpenScope ? () => onOpenScope(scope.id) : undefined}
          />
        ))}
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={sortedScopes.map((s) => s.id)}
        strategy={rectSortingStrategy}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedScopes.map((scope) => (
            <SortableScopeCard
              key={scope.id}
              scope={scope}
              onOpen={onOpenScope ? () => onOpenScope(scope.id) : undefined}
              onDelete={onDeleteScope ? () => onDeleteScope(scope.id) : undefined}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
