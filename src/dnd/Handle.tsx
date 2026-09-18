import { GripVertical } from 'lucide-react';
import type { useSortable } from '@dnd-kit/sortable';
export function Handle({ sort, label }: { sort: ReturnType<typeof useSortable>; label: string }) {
  return (
    <button
      type="button"
      ref={sort.setActivatorNodeRef}
      className="drag-handle icon-button"
      {...sort.attributes}
      {...sort.listeners}
      aria-label={label}
      title="Drag to reorder, or press Space and use arrow keys"
      onClick={(e) => e.stopPropagation()}
    >
      <GripVertical size={15} />
    </button>
  );
}
