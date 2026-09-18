import { useEffect } from 'react';
import { useStore } from 'zustand';
import { ArrowRightLeft, Star, Trash2, X } from 'lucide-react';
import type { Task } from '../domain';
import { appStore, notes } from '../state/app';
import { useUi } from '../state/ui';
import { Attachments } from './Attachments';
import { EditableText } from './EditableText';
import { Steps } from './Steps';
export function TaskDetail({ task }: { task: Task }) {
  const draft = useStore(notes.store, (s) => s.drafts[task.id]);
  useEffect(
    () => () => {
      void notes.flush(task.id);
    },
    [task.id],
  );
  return (
    <aside id="task-detail" className="task-detail" aria-label="Task details" tabIndex={-1}>
      <header className="detail-header">
        <span>Task details</span>
        <button
          type="button"
          className="icon-button"
          aria-label="Close task details"
          onClick={() => appStore.getState().selectTask(null)}
        >
          <X size={18} />
        </button>
      </header>
      <div className="detail-scroll">
        <div className="detail-title">
          <input
            type="checkbox"
            className="completion"
            aria-label="Task completed"
            checked={task.isCompleted}
            onChange={(e) => {
              void appStore
                .getState()
                .mutate({ kind: 'completeTask', id: task.id, completed: e.target.checked });
            }}
          />
          <EditableText
            className="detail-title-text"
            value={task.title}
            label="Task title"
            editOnClick
            onSave={(title) =>
              appStore.getState().mutate({ kind: 'updateTask', id: task.id, title })
            }
          />
          <button
            type="button"
            className={`icon-button star ${task.isImportant ? 'important' : ''}`}
            aria-label="Mark task important"
            aria-pressed={task.isImportant}
            onClick={() => {
              void appStore
                .getState()
                .mutate({ kind: 'updateTask', id: task.id, important: !task.isImportant });
            }}
          >
            <Star size={18} fill={task.isImportant ? 'currentColor' : 'none'} />
          </button>
        </div>
        <Steps taskId={task.id} />
        <section className="detail-section notes-section">
          <div className="section-label">
            <label htmlFor="task-notes">Notes</label>
            <span className="save-state" role="status">
              {draft?.status === 'error'
                ? 'Not saved'
                : draft?.status === 'saving'
                  ? 'Saving…'
                  : draft
                    ? 'Unsaved'
                    : 'Saved'}
            </span>
          </div>
          <textarea
            id="task-notes"
            aria-label="Task notes"
            placeholder="Add a note…"
            value={draft?.text ?? task.notes}
            onChange={(e) => notes.edit(task.id, e.target.value)}
            onBlur={() => {
              void notes.flush(task.id);
            }}
          />
          {draft?.status === 'error' && (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                void notes.flush(task.id);
              }}
            >
              Retry saving notes
            </button>
          )}
        </section>
        <Attachments taskId={task.id} />
      </div>
      <footer className="detail-footer">
        <button
          type="button"
          className="text-button"
          onClick={() => useUi.getState().requestMove(task.id)}
        >
          <ArrowRightLeft size={16} />
          Move to list
        </button>
        <button
          type="button"
          className="icon-button danger-text"
          aria-label="Delete selected task"
          onClick={() => useUi.getState().requestDelete(task.id)}
        >
          <Trash2 size={17} />
        </button>
      </footer>
    </aside>
  );
}
