import { useEffect } from 'react';
import { useStore } from 'zustand';
import { isTauri } from '@tauri-apps/api/core';
import { X } from 'lucide-react';
import { appStore, notes, useApp } from './state/app';
import { DragProvider } from './dnd/DragProvider';
import { useDesktop } from './hooks/useDesktop';
import { Sidebar } from './components/Sidebar';
import { TaskPanel } from './components/TaskPanel';
import { TaskDetail } from './components/TaskDetail';
import { TaskDialogs } from './components/TaskDialogs';
export default function App() {
  const loaded = useApp((s) => s.loaded),
    loading = useApp((s) => s.loading),
    error = useApp((s) => s.error),
    warning = useApp((s) => s.data.warning),
    pending = useApp((s) => s.pending),
    task = useApp((s) => s.data.tasks.find((t) => t.id === s.selectedTaskId)),
    failedNotes = useStore(notes.store, (s) =>
      Object.values(s.drafts).some((d) => d.status === 'error'),
    );
  useDesktop();
  useEffect(() => {
    if (isTauri()) void appStore.getState().load();
    else
      appStore
        .getState()
        .setError(
          'Open Clearlist with npm run tauri dev. The desktop application provides local storage.',
        );
  }, []);
  if (!loaded)
    return (
      <div className="startup">
        <h1>Clearlist</h1>
        <p role={error ? 'alert' : 'status'}>{error ?? 'Opening your lists…'}</p>
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            void appStore.getState().load();
          }}
        >
          Retry
        </button>
      </div>
    );
  return (
    <div className="app-shell">
      {(error || warning || failedNotes) && (
        <div className="error-bar" role="alert">
          <span>{error ?? warning ?? 'Some notes have not been saved.'}</span>
          {failedNotes && (
            <button
              type="button"
              onClick={() => {
                void notes.flushAll();
              }}
            >
              Retry notes
            </button>
          )}
          {error && (
            <button
              type="button"
              className="icon-button"
              aria-label="Dismiss error"
              onClick={() => appStore.getState().setError(null)}
            >
              <X size={16} />
            </button>
          )}
        </div>
      )}
      <DragProvider>
        <div className={`workspace ${task ? 'with-details' : ''}`}>
          <Sidebar />
          <TaskPanel />
          {task && <TaskDetail key={task.id} task={task} />}
        </div>
      </DragProvider>
      <div className="app-status" role="status" aria-live="polite">
        {pending ? 'Saving…' : 'Saved locally'}
      </div>
      <TaskDialogs />
    </div>
  );
}
