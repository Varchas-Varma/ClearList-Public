import { Fragment, useDeferredValue, useEffect, useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { searchTasks, taskOrder, type Task } from '../domain';
import type { DragItem } from '../dnd/actions';
import { appStore, useApp } from '../state/app';
import { useTreeUi } from '../state/treeUi';
import { useTaskNavigation } from '../hooks/useTaskNavigation';
import { canPlace, targetKey, type Place } from '../tree';
import { usePreferences } from '../settings/preferences';
import { keyLabel } from '../settings/shortcuts';
import { useUi } from '../state/ui';
import { AddField } from './AddField';
import { TaskRow } from './TaskRow';
function Gap({ place }: { place: Place }) {
  const movingId = useTreeUi((s) => s.movingId ?? s.draggingId);
  const target = useTreeUi((s) => s.target);
  const tasks = useApp((s) => s.data.tasks);
  const key = targetKey({ kind: 'gap', ...place });
  const drop = useDroppable({
    id: key,
    data: {
      kind: 'gap',
      id: key,
      label: place.parentId ? 'Subtask position' : 'Task position',
      ...place,
    } satisfies DragItem,
    disabled: !movingId || !canPlace(tasks, movingId, place),
  });
  const selected = !!movingId && target?.kind === 'gap' && targetKey(target) === key;
  return (
    <li
      ref={drop.setNodeRef}
      id={`gap-${place.parentId ?? 'root'}-${place.beforeId ?? 'end'}-${String(place.completed)}`}
      data-gap="true"
      tabIndex={-1}
      aria-label={place.parentId ? 'Insert subtask here' : 'Insert task here'}
      onFocus={() => useTreeUi.getState().setTarget({ kind: 'gap', ...place })}
      className={`task-gap ${movingId ? 'moving' : ''} ${drop.isOver || selected ? 'gap-target' : ''}`}
    >
      <span>{place.parentId ? 'Insert subtask here' : 'Insert task here'}</span>
    </li>
  );
}
function TaskGroup({
  tasks,
  childrenByParent,
  listId,
  parentId,
  completed,
  searchResult = false,
}: {
  tasks: Task[];
  childrenByParent: Map<string, Task[]>;
  listId: string;
  parentId: string | null;
  completed: boolean | null;
  searchResult?: boolean;
}) {
  const collapsed = useTreeUi((s) => s.collapsed);
  return (
    <ul
      className={parentId ? 'tasks subtask-list' : 'tasks'}
      aria-label={parentId ? 'Subtasks' : 'Tasks'}
    >
      {tasks.map((task, index) => {
        const children = childrenByParent.get(task.id) ?? [];
        return (
          <Fragment key={task.id}>
            {!searchResult && <Gap place={{ listId, parentId, beforeId: task.id, completed }} />}
            <li className="task-branch">
              <TaskRow
                task={task}
                siblings={tasks}
                index={index}
                searchResult={searchResult}
                stepCount={children.length}
                doneSteps={children.filter((t) => t.isCompleted).length}
              />
              {!searchResult && !collapsed[task.id] && children.length > 0 && (
                <TaskGroup
                  tasks={children}
                  childrenByParent={childrenByParent}
                  listId={listId}
                  parentId={task.id}
                  completed={null}
                />
              )}
              {!searchResult && !collapsed[task.id] && children.length === 0 && (
                <EmptyChildren task={task} />
              )}
            </li>
          </Fragment>
        );
      })}
      {!searchResult && <Gap place={{ listId, parentId, beforeId: null, completed }} />}
    </ul>
  );
}
function EmptyChildren({ task }: { task: Task }) {
  const target = useTreeUi((s) => s.target);
  const moving = useTreeUi((s) => s.movingId);
  if (!moving || target?.kind !== 'gap' || target.parentId !== task.id) return null;
  return (
    <ul className="tasks subtask-list" aria-label="Subtasks">
      <Gap place={{ listId: task.listId, parentId: task.id, beforeId: null, completed: null }} />
    </ul>
  );
}
export function TaskPanel() {
  const data = useApp((s) => s.data),
    selectedListId = useApp((s) => s.selectedListId),
    query = useApp((s) => s.search),
    search = useDeferredValue(query);
  const completedOpen = useTreeUi((s) => s.completedOpen);
  const setCompletedOpen = (completedOpen: boolean) => useTreeUi.setState({ completedOpen });
  const hotkeys = usePreferences((s) => s.hotkeys);
  const movingId = useTreeUi((s) => s.movingId ?? s.draggingId),
    target = useTreeUi((s) => s.target);
  const results = useMemo(() => searchTasks(data, search), [data, search]);
  const childrenByParent = useMemo(() => {
    const result = new Map<string, Task[]>();
    for (const task of data.tasks)
      if (task.parentId) {
        const group = result.get(task.parentId) ?? [];
        group.push(task);
        result.set(task.parentId, group);
      }
    for (const group of result.values())
      group.sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
    return result;
  }, [data.tasks]);
  useEffect(() => {
    useTreeUi.getState().setMoving(null);
  }, [selectedListId, query]);
  const list = data.lists.find((l) => l.id === selectedListId),
    active = taskOrder(data.tasks, selectedListId ?? '', false),
    completed = taskOrder(data.tasks, selectedListId ?? '', true),
    isSearch = !!query.trim();
  const moving = data.tasks.find((t) => t.id === movingId);
  const keyboard = useTaskNavigation(isSearch);
  const targetTask =
    target?.kind === 'row' ? data.tasks.find((t) => t.id === target.id) : undefined;
  return (
    <main
      className="task-panel"
      aria-label={isSearch ? 'Search results' : `${list?.name ?? 'Tasks'} tasks`}
      onKeyDownCapture={keyboard}
      onFocusCapture={(e) => {
        const id = (e.target as HTMLElement).closest<HTMLElement>('[data-task-id]')?.dataset.taskId;
        if (id) useTreeUi.getState().setTarget({ kind: 'row', id });
      }}
    >
      <header className="task-panel-header">
        <h1>{isSearch ? 'Search results' : list?.name}</h1>
        <p className="muted">
          {isSearch
            ? `${results.length} results across all lists`
            : `${active.length} ${active.length === 1 ? 'task' : 'tasks'}`}
        </p>
      </header>
      <div className="task-scroll" aria-busy={query !== search}>
        {isSearch ? (
          <>
            {results.length ? (
              <TaskGroup
                tasks={results}
                childrenByParent={childrenByParent}
                listId={selectedListId ?? ''}
                parentId={null}
                completed={null}
                searchResult
              />
            ) : (
              <p className="empty-state">No matching tasks.</p>
            )}
          </>
        ) : (
          <>
            <TaskGroup
              tasks={active}
              childrenByParent={childrenByParent}
              listId={selectedListId ?? ''}
              parentId={null}
              completed={false}
            />
            {!active.length && (
              <p className="empty-state">
                {completed.length ? 'All tasks completed.' : 'Add a task to get started.'}
              </p>
            )}
            {(completed.length > 0 || moving?.isCompleted) && (
              <section className="completed-section" aria-label="Completed tasks">
                <button
                  type="button"
                  className="completed-toggle"
                  aria-expanded={completedOpen || !!moving}
                  onClick={() => setCompletedOpen(!completedOpen)}
                >
                  {completedOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}Completed{' '}
                  <span className="count">{completed.length}</span>
                </button>
                {(completedOpen || !!moving) && (
                  <TaskGroup
                    tasks={completed}
                    childrenByParent={childrenByParent}
                    listId={selectedListId ?? ''}
                    parentId={null}
                    completed={true}
                  />
                )}
              </section>
            )}
          </>
        )}
      </div>
      {!isSearch && list && (
        <div className="task-entry">
          <p id="task-keyboard-help" className="keyboard-hint" role="status">
            {moving
              ? `Moving “${moving.title}” · ${keyLabel(hotkeys.pickMove)}: ${targetTask ? `subtask of “${targetTask.title}”` : 'drop here'} · ${keyLabel(hotkeys.previousItem)}/${keyLabel(hotkeys.nextItem)}: position · ${keyLabel(hotkeys.enterSubtasks)}: subtasks · ${keyLabel(hotkeys.leaveSubtasks)}: parent · ${keyLabel(hotkeys.cancel)}: cancel`
              : ` ${keyLabel(hotkeys.previousItem)}/${keyLabel(hotkeys.nextItem)} Browse · ${keyLabel(hotkeys.pickMove)} Move · ${keyLabel(hotkeys.renameTask)} Rename · ${keyLabel(hotkeys.newTask)} Add task`}
          </p>
          <AddField
            key={list.id}
            label="Add a task"
            id="new-task"
            onAdd={(title) =>
              appStore
                .getState()
                .mutate({ kind: 'createTask', id: crypto.randomUUID(), listId: list.id, title })
            }
          />
          <button
            type="button"
            className="text-button keyboard-help"
            onClick={() => useUi.getState().openSettings('hotkeys')}
          >
            Keyboard shortcuts
          </button>
        </div>
      )}
    </main>
  );
}
