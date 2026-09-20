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
  type CollisionDetection,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { appStore } from '../state/app';
import { useTreeUi, focusTarget } from '../state/treeUi';
import { branchIds, canPlace } from '../tree';
import { reorder, type DragItem } from './actions';
const keyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
  const rects = new Map(
    [...args.context.droppableRects].filter(
      ([id]) => args.context.droppableContainers.get(id)?.data.current?.kind === 'list',
    ),
  );
  return sortableKeyboardCoordinates(event, {
    ...args,
    context: { ...args.context, droppableRects: rects },
  });
};
const collision: CollisionDetection = (args) => {
  const source = args.active.data.current as DragItem | undefined;
  const data = appStore.getState().data;
  const excluded = source?.kind === 'task' ? branchIds(data.tasks, source.id) : new Set<string>();
  const containers = args.droppableContainers.filter((c) => {
    const target = c.data.current as DragItem | undefined;
    if (source?.kind === 'list') return target?.kind === 'list';
    if (source?.kind !== 'task' || !target) return false;
    if (target.kind === 'list-drop') return true;
    if (target.kind === 'task') return !excluded.has(target.id);
    return target.kind === 'gap' && canPlace(data.tasks, source.id, target);
  });
  const filtered = { ...args, droppableContainers: containers };
  return source?.kind === 'list' ? closestCenter(filtered) : pointerWithin(filtered);
};
export function DragProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<DragItem | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinates }),
  );
  function clear() {
    setActive(null);
    useTreeUi.setState({ draggingId: null });
  }
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={({ active }) => {
        const item = active.data.current as DragItem;
        setActive(item);
        useTreeUi.setState({
          draggingId: item.kind === 'task' ? item.id : null,
          movingId: null,
          target: null,
        });
      }}
      onDragCancel={clear}
      onDragEnd={({ active, over }) => {
        clear();
        const source = active.data.current as DragItem | undefined;
        const target = over?.data.current as DragItem | undefined;
        if (!source || !target) return;
        if (source.kind === 'list') {
          reorder(source, target.id);
          return;
        }
        if (source.kind !== 'task') return;
        const task = appStore.getState().data.tasks.find((t) => t.id === source.id);
        if (!task) return;
        if (target.kind === 'list-drop') {
          void appStore.getState().mutate({ kind: 'moveTask', id: task.id, listId: target.id });
        } else if (target.kind === 'task' || target.kind === 'gap') {
          const parentId = target.kind === 'task' ? target.id : target.parentId;
          if (parentId) useTreeUi.getState().expand(parentId);
          void appStore
            .getState()
            .mutate({
              kind: 'placeTask',
              id: task.id,
              listId: target.listId,
              parentId,
              beforeId: target.kind === 'gap' ? target.beforeId : null,
            })
            .then((ok) => {
              if (ok) focusTarget({ kind: 'row', id: task.id });
            });
        }
      }}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {active && <div className="drag-overlay">{active.label}</div>}
      </DragOverlay>
    </DndContext>
  );
}
