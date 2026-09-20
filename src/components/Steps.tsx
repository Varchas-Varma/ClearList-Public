import { children } from '../tree';
import { appStore, useApp } from '../state/app';
import { useTreeUi } from '../state/treeUi';
import { AddField } from './AddField';
export function Steps({ taskId }: { taskId: string }) {
  const tasks = useApp((s) => s.data.tasks);
  const subtasks = children(tasks, taskId);
  return (
    <section className="detail-section" aria-label="Subtasks">
      <h3>Subtasks</h3>
      {subtasks.length > 0 && (
        <ul className="detail-subtasks">
          {subtasks.map((task) => (
            <li key={task.id}>
              <input
                type="checkbox"
                checked={task.isCompleted}
                aria-label={`Complete subtask ${task.title}`}
                onChange={(e) => {
                  void appStore
                    .getState()
                    .mutate({ kind: 'completeTask', id: task.id, completed: e.target.checked });
                }}
              />
              <button
                type="button"
                className="editable-text"
                onClick={() => appStore.getState().selectTask(task.id)}
              >
                {task.title}
              </button>
            </li>
          ))}
        </ul>
      )}
      <AddField
        id="new-subtask"
        label="Add a subtask"
        onAdd={async (title) => {
          useTreeUi.getState().expand(taskId);
          return appStore
            .getState()
            .mutate({ kind: 'createStep', id: crypto.randomUUID(), taskId, title });
        }}
      />
    </section>
  );
}
