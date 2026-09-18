import { useState, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { appStore } from '../state/app';
import { reorder, type DragItem } from './actions';
function sameScope(source: DragItem | undefined, target: DragItem | undefined): boolean {
  if (!source || !target || source.kind !== target.kind) return false;
  if (source.kind === 'list') return true;
  if (source.kind === 'step' && target.kind === 'step') return source.taskId === target.taskId;
  return (
    source.kind === 'task' &&
    target.kind === 'task' &&
    source.listId === target.listId &&
    source.completed === target.completed
  );
}
const keyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
  const source = args.context.active?.data.current as DragItem | undefined;
  const droppableRects = new Map(
    [...args.context.droppableRects].filter(([id]) =>
      sameScope(
        source,
        args.context.droppableContainers.get(id)?.data.current as DragItem | undefined,
      ),
    ),
  );
  return sortableKeyboardCoordinates(event, {
    ...args,
    context: { ...args.context, droppableRects },
  });
};
const announcements: Announcements = {
  onDragStart: ({ active }) => `Picked up ${active.data.current?.label ?? 'item'}.`,
  onDragOver: ({ active, over }) =>
    over
      ? `${active.data.current?.label ?? 'Item'} is over ${over.data.current?.label ?? 'a drop target'}.`
      : 'No drop target.',
  onDragEnd: ({ active, over }) =>
    over
      ? `Dropped ${active.data.current?.label ?? 'item'} at ${over.data.current?.label ?? 'the target'}.`
      : 'Reordering cancelled.',
  onDragCancel: () => 'Reordering cancelled.',
};
const collision: CollisionDetection = (args) => {
  const source = args.active.data.current as DragItem | undefined;
  const containers = args.droppableContainers.filter((c) => {
    const target = c.data.current as DragItem | undefined;
    return sameScope(source, target) || (source?.kind === 'task' && target?.kind === 'list-drop');
  });
  const filtered = { ...args, droppableContainers: containers },
    hits = pointerWithin(filtered);
  return hits.length
    ? hits
    : closestCenter({
        ...filtered,
        droppableContainers: containers.filter((c) => c.data.current?.kind !== 'list-drop'),
      });
};
export function DragProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<DragItem | null>(null),
    sensors = useSensors(
      useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
      useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinates }),
    );
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            'Press Space to pick up. Use arrow keys to reorder. Press Space to drop, or Escape to cancel.',
        },
      }}
      onDragStart={({ active }) => setActive(active.data.current as DragItem)}
      onDragCancel={() => setActive(null)}
      onDragEnd={({ active, over }) => {
        setActive(null);
        if (!over) return;
        const source = active.data.current as DragItem | undefined,
          target = over.data.current as DragItem | undefined;
        if (!source || !target) return;
        if (source.kind === 'task' && target.kind === 'list-drop') {
          if (source.listId !== target.id)
            void appStore.getState().mutate({ kind: 'moveTask', id: source.id, listId: target.id });
        } else reorder(source, target.id);
      }}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {active && <div className="drag-overlay">{active.label}</div>}
      </DragOverlay>
    </DndContext>
  );
}
