import { useDraggable, useDroppable } from '@dnd-kit/core';
import { ChevronDown, ChevronRight, Star } from 'lucide-react';
import type { Task } from '../domain';
import { dragId, reorder, type DragItem } from '../dnd/actions';
import { Handle } from '../dnd/Handle';
import { appStore, notes, useApp } from '../state/app';
import { useUi } from '../state/ui';
import { focusTarget, useTreeUi } from '../state/treeUi';
import { usePreferences } from '../settings/preferences';
import { keyLabel, type CommandId } from '../settings/shortcuts';
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
  const hotkeys = usePreferences((s) => s.hotkeys);
  const label = (text: string, id: CommandId) =>
    hotkeys[id] ? `${text} (${keyLabel(hotkeys[id])})` : text;
  const selected = useApp((s) => s.selectedTaskId === task.id);
  const listName = useApp((s) => s.data.lists.find((l) => l.id === task.listId)?.name);
  const editing = useTreeUi((s) => s.editingId === task.id);
  const collapsed = useTreeUi((s) => !!s.collapsed[task.id]);
  const moving = useTreeUi((s) => s.movingId === task.id);
  const target = useTreeUi(
    (s) => !!s.movingId && s.target?.kind === 'row' && s.target.id === task.id,
  );
  const item: DragItem = {
    kind: 'task',
    id: task.id,
    label: task.title,
    listId: task.listId,
    completed: task.isCompleted,
  };
  const drag = useDraggable({
    id: dragId('task', task.id),
    data: item,
    disabled: searchResult || editing,
  });
  const drop = useDroppable({
    id: dragId('task-target', task.id),
    data: item,
    disabled: searchResult || editing,
  });
  function setEditing(value: boolean) {
    useTreeUi.getState().setEditing(value ? task.id : null);
    if (!value) focusTarget({ kind: 'row', id: task.id });
  }
  return (
    <div
      ref={(node) => {
        drag.setNodeRef(node);
        drop.setNodeRef(node);
      }}
      id={`task-${task.id}`}
      data-task-id={task.id}
      tabIndex={0}
      aria-label={`${task.parentId ? 'Subtask' : 'Task'} ${task.title}`}
      aria-describedby="task-keyboard-help"
      className={`task-row ${selected ? 'selected' : ''} ${drop.isOver || target ? 'drop-target nest-target' : ''} ${drag.isDragging || moving ? 'dragging' : ''} ${task.isCompleted ? 'completed' : ''}`}
      onClick={(e) => {
        if (e.target instanceof Element && e.target.closest('button,input')) return;
        appStore.getState().selectTask(task.id);
      }}
    >
      {!searchResult && <Handle sort={drag} label={`Move task ${task.title}`} />}
      {stepCount > 0 && (
        <button
          type="button"
          className="icon-button tree-toggle"
          aria-label={`${collapsed ? 'Expand' : 'Collapse'} subtasks of ${task.title}`}
          aria-expanded={!collapsed}
          onClick={(e) => {
            e.stopPropagation();
            useTreeUi.getState().toggle(task.id);
          }}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
      )}
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
                {doneSteps}/{stepCount} subtasks
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
          { label: label('Rename', 'renameTask'), run: () => setEditing(true) },
          {
            label: label('Add subtask', 'newSubtask'),
            run: () => {
              appStore.getState().selectTask(task.id);
              requestAnimationFrame(() => document.getElementById('new-subtask')?.focus());
            },
          },
          { label: 'Move to list…', run: () => useUi.getState().requestMove(task.id) },
          ...(task.parentId
            ? [
                {
                  label: 'Make top-level task',
                  run: () => {
                    void appStore.getState().mutate({
                      kind: 'placeTask',
                      id: task.id,
                      listId: task.listId,
                      parentId: null,
                      beforeId: null,
                    });
                  },
                },
              ]
            : []),
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
            label: label('Duplicate', 'duplicateTask'),
            run: () => {
              void (async () => {
                if (!(await notes.flushAll())) return;
                const newId = crypto.randomUUID();
                if (await appStore.getState().mutate({ kind: 'duplicateTask', id: task.id, newId }))
                  appStore.getState().selectTask(newId);
              })();
            },
          },
          {
            label: label('Delete task…', 'deleteTask'),
            danger: true,
            run: () => useUi.getState().requestDelete(task.id),
          },
        ]}
      />
    </div>
  );
}
