import { useStore } from 'zustand';
import { ArrowRightLeft, Check, Trash2, Undo2, X } from 'lucide-react';
import { appStore, notes, useApp } from '../state/app';
import { addSubtasks } from '../state/selection';
import { branches, orderedTasks } from '../tree';
import { runCommand } from '../settings/actions';
import { AttachmentTile } from './Attachments';
import { AddField } from './AddField';

export function TaskSummaries({
  ids,
  label = 'Task notes and images',
}: {
  ids: string[];
  label?: string;
}) {
  const data = useApp((s) => s.data);
  const drafts = useStore(notes.store, (s) => s.drafts);
  const included = branches(data.tasks, ids);
  const tasks = orderedTasks(
    data.tasks,
    data.lists.map((l) => l.id),
  ).filter((t) => included.has(t.id));
  return (
    <section className="detail-section summary-section" aria-label={label}>
      <h3>{label}</h3>
      <div
        className="task-summaries"
        tabIndex={0}
        role="region"
        aria-label={`${label} scroll area`}
      >
        {tasks.map((task) => {
          const firstLine = (drafts[task.id]?.text ?? task.notes).split(/\r?\n/, 1)[0];
          const images = data.attachments
            .filter((a) => a.taskId === task.id)
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
          return (
            <article
              key={task.id}
              className="task-summary"
              aria-label={`Summary for ${task.title}`}
            >
              <button
                type="button"
                className="text-button summary-title"
                onClick={() => appStore.getState().selectTask(task.id)}
              >
                {task.parentId ? '↳ ' : ''}
                {task.title}
              </button>
              <p className="note-first-line" title={firstLine}>
                {firstLine || 'No note'}
              </p>
              {images.length > 0 && (
                <div className="attachments">
                  {images.map((attachment) => (
                    <AttachmentTile key={attachment.id} attachment={attachment} />
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function SelectionDetail() {
  const ids = useApp((s) => s.selectedTaskIds);
  return (
    <aside
      id="task-detail"
      className="task-detail"
      aria-label="Selected task details"
      tabIndex={-1}
    >
      <header className="detail-header">
        <span>{ids.length} selected tasks</span>
        <button
          type="button"
          className="icon-button"
          aria-label="Close selected task details"
          onClick={() => appStore.getState().selectTask(null)}
        >
          <X size={18} />
        </button>
      </header>
      <div className="detail-scroll">
        <div className="batch-actions" role="toolbar" aria-label="Selected task actions">
          <button type="button" onClick={() => runCommand('markCompleted')}>
            <Check size={15} />
            Complete all
          </button>
          <button type="button" onClick={() => runCommand('markIncomplete')}>
            <Undo2 size={15} />
            Uncomplete all
          </button>
          <button type="button" onClick={() => runCommand('renameTask')}>
            Rename all
          </button>
          <button type="button" onClick={() => runCommand('promoteTask')}>
            Make top level
          </button>
        </div>
        <section className="detail-section" aria-label="Add subtask to selection">
          <h3>Add a subtask to each selected task</h3>
          <AddField
            id="new-subtask"
            label="Subtask for each selected task"
            onAdd={(title) => addSubtasks(ids, title)}
          />
        </section>
        <div id="task-notes" tabIndex={-1}>
          <div id="task-images" tabIndex={-1}>
            <TaskSummaries ids={ids} label="Selected tasks and subtasks" />
          </div>
        </div>
      </div>
      <footer className="detail-footer">
        <button type="button" className="text-button" onClick={() => runCommand('moveToList')}>
          <ArrowRightLeft size={16} />
          Move selection to list
        </button>
        <button
          type="button"
          className="icon-button danger-text"
          aria-label="Delete selected tasks"
          onClick={() => runCommand('deleteTask')}
        >
          <Trash2 size={17} />
        </button>
      </footer>
    </aside>
  );
}
