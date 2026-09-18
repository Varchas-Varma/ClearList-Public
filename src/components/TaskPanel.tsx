import { useDeferredValue, useMemo, useState } from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { searchTasks, taskOrder, type Task } from '../domain';
import { dragId } from '../dnd/actions';
import { appStore, useApp } from '../state/app';
import { AddField } from './AddField';
import { TaskRow } from './TaskRow';
function TaskGroup({
  tasks,
  stats,
  searchResult = false,
}: {
  tasks: Task[];
  stats: Map<string, { total: number; done: number }>;
  searchResult?: boolean;
}) {
  return (
    <SortableContext
      items={tasks.map((t) => dragId('task', t.id))}
      strategy={verticalListSortingStrategy}
    >
      <ul className="tasks">
        {tasks.map((task, index) => (
          <TaskRow
            key={task.id}
            task={task}
            siblings={tasks}
            index={index}
            searchResult={searchResult}
            stepCount={stats.get(task.id)?.total}
            doneSteps={stats.get(task.id)?.done}
          />
        ))}
      </ul>
    </SortableContext>
  );
}
export function TaskPanel() {
  const data = useApp((s) => s.data),
    selectedListId = useApp((s) => s.selectedListId),
    query = useApp((s) => s.search),
    search = useDeferredValue(query),
    [completedOpen, setCompletedOpen] = useState(true);
  const results = useMemo(() => searchTasks(data, search), [data, search]);
  const stats = useMemo(() => {
    const result = new Map<string, { total: number; done: number }>();
    for (const step of data.steps) {
      const row = result.get(step.taskId) ?? { total: 0, done: 0 };
      row.total++;
      if (step.isCompleted) row.done++;
      result.set(step.taskId, row);
    }
    return result;
  }, [data.steps]);
  const list = data.lists.find((l) => l.id === selectedListId),
    active = taskOrder(data.tasks, selectedListId ?? '', false),
    completed = taskOrder(data.tasks, selectedListId ?? '', true),
    isSearch = !!query.trim();
  return (
    <main
      className="task-panel"
      aria-label={isSearch ? 'Search results' : `${list?.name ?? 'Tasks'} tasks`}
    >
      <header className="task-panel-header">
        <h1>{isSearch ? 'Search results' : list?.name}</h1>
        <p className="muted">
          {isSearch
            ? `${results.length} ${results.length === 1 ? 'result' : 'results'} across all lists`
            : `${active.length} ${active.length === 1 ? 'task' : 'tasks'}`}
        </p>
      </header>
      <div className="task-scroll" aria-busy={query !== search}>
        {isSearch ? (
          <>
            {results.length ? (
              <TaskGroup tasks={results} stats={stats} searchResult />
            ) : (
              <p className="empty-state">No matching tasks.</p>
            )}
          </>
        ) : (
          <>
            <TaskGroup tasks={active} stats={stats} />
            {!active.length && (
              <p className="empty-state">
                {completed.length ? 'All tasks completed.' : 'Add a task to get started.'}
              </p>
            )}
            {completed.length > 0 && (
              <section className="completed-section" aria-label="Completed tasks">
                <button
                  type="button"
                  className="completed-toggle"
                  aria-expanded={completedOpen}
                  onClick={() => setCompletedOpen(!completedOpen)}
                >
                  {completedOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}Completed{' '}
                  <span className="count">{completed.length}</span>
                </button>
                {completedOpen && <TaskGroup tasks={completed} stats={stats} />}
              </section>
            )}
          </>
        )}
      </div>
      {!isSearch && list && (
        <div className="task-entry">
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
        </div>
      )}
    </main>
  );
}
