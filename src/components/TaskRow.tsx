import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Star } from 'lucide-react';
import type { Task } from '../domain';
import { dragId, reorder, type DragItem } from '../dnd/actions';
import { Handle } from '../dnd/Handle';
import { appStore, notes, useApp } from '../state/app';
import { useUi } from '../state/ui';
import { ActionMenu } from './ActionMenu';
import { EditableText } from './EditableText';
export function TaskRow({
  task,
  siblings,
  index,
  searchResult = false,
  stepCount = 0,
  doneSteps = 0,
}: {
  task: Task;
  siblings: Task[];
  index: number;
  searchResult?: boolean;
  stepCount?: number;
  doneSteps?: number;
}) {
  const selected = useApp((s) => s.selectedTaskId === task.id),
    listName = useApp((s) => s.data.lists.find((l) => l.id === task.listId)?.name),
    [editing, setEditing] = useState(false);
  const item: DragItem = {
      kind: 'task',
      id: task.id,
      label: task.title,
      listId: task.listId,
      completed: task.isCompleted,
    },
    sort = useSortable({
      id: dragId('task', task.id),
      data: item,
      disabled: searchResult || editing,
    });
  return (
    <li
      ref={sort.setNodeRef}
      style={{ transform: CSS.Transform.toString(sort.transform), transition: sort.transition }}
      className={`task-row ${selected ? 'selected' : ''} ${sort.isOver ? 'drop-target' : ''} ${sort.isDragging ? 'dragging' : ''} ${task.isCompleted ? 'completed' : ''}`}
      onClick={() => appStore.getState().selectTask(task.id)}
    >
      {!searchResult && <Handle sort={sort} label={`Reorder task ${task.title}`} />}
      <input
        type="checkbox"
        className="completion"
        aria-label={`Complete ${task.title}`}
        checked={task.isCompleted}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          void appStore
            .getState()
            .mutate({ kind: 'completeTask', id: task.id, completed: e.target.checked });
        }}
      />
      <div className="task-title-block">
        <EditableText
          value={task.title}
          label={`Task: ${task.title}${selected ? ', selected' : ''}`}
          editing={editing}
          setEditing={setEditing}
          onSelect={() => appStore.getState().selectTask(task.id)}
          onSave={(title) => appStore.getState().mutate({ kind: 'updateTask', id: task.id, title })}
        />
        {(searchResult || stepCount > 0) && (
          <div className="task-meta">
            {searchResult && <span>{listName}</span>}
            {stepCount > 0 && (
              <span>
                {doneSteps}/{stepCount} steps
              </span>
            )}
          </div>
        )}
      </div>
      <button
        type="button"
        className={`icon-button star ${task.isImportant ? 'important' : ''}`}
        aria-label={`Important: ${task.title}`}
        aria-pressed={task.isImportant}
        onClick={(e) => {
          e.stopPropagation();
          void appStore
            .getState()
            .mutate({ kind: 'updateTask', id: task.id, important: !task.isImportant });
        }}
      >
        <Star size={18} fill={task.isImportant ? 'currentColor' : 'none'} />
      </button>
      <ActionMenu
        label={`Actions for task ${task.title}`}
        actions={[
          { label: 'Rename', run: () => setEditing(true) },
          { label: 'Move to list…', run: () => useUi.getState().requestMove(task.id) },
          {
            label: 'Move up',
            disabled: searchResult || index === 0,
            run: () => reorder(item, siblings[index - 1].id),
          },
          {
            label: 'Move down',
            disabled: searchResult || index === siblings.length - 1,
            run: () => reorder(item, siblings[index + 1].id),
          },
          {
            label: 'Duplicate',
            run: () => {
              void (async () => {
                if (!(await notes.flush(task.id))) return;
                const newId = crypto.randomUUID();
                if (await appStore.getState().mutate({ kind: 'duplicateTask', id: task.id, newId }))
                  appStore.getState().selectTask(newId);
              })();
            },
          },
          {
            label: 'Delete task…',
            danger: true,
            run: () => useUi.getState().requestDelete(task.id),
          },
        ]}
      />
    </li>
  );
}
