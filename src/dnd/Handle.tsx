import { GripVertical } from 'lucide-react';
import type { useDraggable } from '@dnd-kit/core';
export function Handle({
  sort,
  label,
}: {
  sort: Pick<ReturnType<typeof useDraggable>, 'attributes' | 'listeners' | 'setActivatorNodeRef'>;
  label: string;
}) {
  return (
    <button
      type="button"
      ref={sort.setActivatorNodeRef}
      className="drag-handle icon-button"
      {...sort.attributes}
      {...sort.listeners}
      aria-label={label}
      title="Drag to move; focus the task and press Enter for keyboard moves"
      onClick={(e) => e.stopPropagation()}
    >
      <GripVertical size={15} />
    </button>
  );
}
