'use client'

import { useState } from 'react'
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

type ScopeGridItem = Omit<ScopeCardProps, 'dragHandleProps' | 'isDragging'>

type ScopeGridProps = {
  scopes: ScopeGridItem[]
  onReorder?: (activeId: string, overId: string) => void
  onTaskToggle?: (scopeId: string, taskId: string, done: boolean) => void
  onReset?: (scopeId: string) => void
}

function SortableScopeCard({
  scope,
  onTaskToggle,
  onReset,
}: {
  scope: ScopeGridItem
  onTaskToggle?: (taskId: string, done: boolean) => void
  onReset?: () => void
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
        onTaskToggle={onTaskToggle}
        onReset={onReset}
      />
    </div>
  )
}

export function ScopeGrid({
  scopes,
  onReorder,
  onTaskToggle,
  onReset,
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
              onTaskToggle={
                onTaskToggle
                  ? (taskId, done) => onTaskToggle(scope.id, taskId, done)
                  : undefined
              }
              onReset={onReset ? () => onReset(scope.id) : undefined}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
