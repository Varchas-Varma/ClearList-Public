import { useDraggable, useDroppable } from '@dnd-kit/core';
import { ChevronDown, ChevronRight, Star, Square, SquareCheck } from 'lucide-react';
import type { Task } from '../domain';
import { dragId, type DragItem } from '../dnd/actions';
import { Handle } from '../dnd/Handle';
import { appStore, useApp } from '../state/app';
import { useUi } from '../state/ui';
import {
  completeSelection,
  selectionFor,
  toggleSelection,
  updateSelection,
} from '../state/selection';
import { runCommand } from '../settings/actions';
import { focusTarget, useTreeUi } from '../state/treeUi';
import { usePreferences } from '../settings/preferences';
import { keyLabel, selectionHeld, type CommandId } from '../settings/shortcuts';
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
  const selected = useApp((s) => s.selectedTaskIds.includes(task.id));
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
    if (value && selectionFor(task.id).length > 1) {
      useUi.setState({ renameTaskIds: selectionFor(task.id) });
      return;
    }
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
      data-selected={selected || undefined}
      onMouseEnter={() => useTreeUi.setState({ hoveredId: task.id })}
      onMouseLeave={() => {
        if (useTreeUi.getState().hoveredId === task.id) useTreeUi.setState({ hoveredId: null });
      }}
      onClickCapture={(e) => {
        if (
          !editing &&
          selectionHeld(e, hotkeys) &&
          e.target instanceof Element &&
          (!e.target.closest('button,input') || e.target.closest('.editable-text'))
        ) {
          e.preventDefault();
          e.stopPropagation();
          toggleSelection(task.id);
        }
      }}
      aria-label={`${task.parentId ? 'Subtask' : 'Task'} ${task.title}`}
      aria-describedby="task-keyboard-help"
      className={`task-row ${selected ? 'selected' : ''} ${drop.isOver || target ? 'drop-target nest-target' : ''} ${drag.isDragging || moving ? 'dragging' : ''} ${task.isCompleted ? 'completed' : ''}`}
      onClick={(e) => {
        if (e.target instanceof Element && e.target.closest('button,input')) return;
        appStore.getState().selectTask(task.id);
      }}
    >
      <button
        type="button"
        className={`icon-button selection-toggle ${selected ? 'is-selected' : ''}`}
        aria-label={`${selected ? 'Deselect' : 'Select'} task ${task.title}`}
        aria-pressed={selected}
        title="Select task for batch actions"
        onClick={(e) => {
          e.stopPropagation();
          toggleSelection(task.id);
        }}
      >
        {selected ? <SquareCheck size={16} /> : <Square size={16} />}
      </button>
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
          void completeSelection(task.id, e.target.checked);
        }}
      />
      <div className="task-title-block">
        <EditableText
          value={task.title}
          label={`Task: ${task.title}${selected && !editing ? ', selected' : ''}`}
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
          void updateSelection(task.id, { important: !task.isImportant });
        }}
      >
        <Star size={18} fill={task.isImportant ? 'currentColor' : 'none'} />
      </button>
      <ActionMenu
        label={`Actions for task ${task.title}`}
        actions={[
          { label: label('Rename', 'renameTask'), run: () => runCommand('renameTask', task.id) },
          {
            label: label('Add subtask', 'newSubtask'),
            run: () => runCommand('newSubtask', task.id),
          },
          { label: 'Complete selection', run: () => runCommand('markCompleted', task.id) },
          { label: 'Uncomplete selection', run: () => runCommand('markIncomplete', task.id) },
          { label: 'Move to list…', run: () => useUi.getState().requestMove(task.id) },
          ...(task.parentId || selectionFor(task.id).length > 1
            ? [
                {
                  label: 'Make top-level task',
                  run: () => runCommand('promoteTask', task.id),
                },
              ]
            : []),
          {
            label: 'Move up',
            disabled: searchResult || (selectionFor(task.id).length < 2 && index === 0),
            run: () => runCommand('moveTaskUp', task.id),
          },
          {
            label: 'Move down',
            disabled:
              searchResult || (selectionFor(task.id).length < 2 && index === siblings.length - 1),
            run: () => runCommand('moveTaskDown', task.id),
          },
          {
            label: label('Duplicate', 'duplicateTask'),
            run: () => runCommand('duplicateTask', task.id),
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
