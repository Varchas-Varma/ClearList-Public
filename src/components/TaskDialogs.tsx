import { useState } from 'react';
import { branches } from '../tree';
import { focusTarget } from '../state/treeUi';
import type { Task } from '../domain';
import { cleanTitle } from '../domain';
import { appStore, notes, useApp } from '../state/app';
import { batch, deleteSelection, placeSelection, purgeChanges } from '../state/selection';
import { useUi } from '../state/ui';
import { Confirm } from './Confirm';
import { Modal } from './Modal';
function MoveDialog({ tasks }: { tasks: Task[] }) {
  const lists = useApp((s) => s.data.lists),
    [destination, setDestination] = useState(tasks[0].listId),
    [busy, setBusy] = useState(false);
  return (
    <Modal
      title={tasks.length > 1 ? `Move ${tasks.length} tasks` : 'Move task'}
      canClose={!busy}
      onClose={() => {
        if (!busy) useUi.getState().requestMove(null);
      }}
    >
      <label className="move-label" htmlFor="destination">
        Move{' '}
        {tasks.length > 1
          ? `${tasks.length} selected tasks and their subtasks`
          : `“${tasks[0].title}”`}{' '}
        to
      </label>
      <select
        autoFocus
        id="destination"
        value={destination}
        disabled={busy}
        onChange={(e) => setDestination(e.target.value)}
      >
        {lists.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
      <div className="dialog-actions">
        <button type="button" disabled={busy} onClick={() => useUi.getState().requestMove(null)}>
          Cancel
        </button>
        <button
          type="button"
          className="primary-button"
          disabled={busy || tasks.every((t) => t.listId === destination && !t.parentId)}
          onClick={async () => {
            setBusy(true);
            const ok = await placeSelection(
              tasks.map((t) => t.id),
              { listId: destination, parentId: null, beforeId: null, completed: null },
            );
            setBusy(false);
            if (ok) useUi.getState().requestMove(null);
          }}
        >
          Move
        </button>
      </div>
    </Modal>
  );
}
function RenameDialog({ ids }: { ids: string[] }) {
  const [value, setValue] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <Modal
      title={`Rename ${ids.length} tasks`}
      canClose={!busy}
      onClose={() => {
        if (!busy) useUi.setState({ renameTaskIds: [] });
      }}
    >
      <p>The new title will be applied to every selected task.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          let title: string;
          try {
            title = cleanTitle(value);
          } catch (e) {
            setError(String((e as Error).message));
            return;
          }
          setBusy(true);
          const ok = await batch(ids.map((id) => ({ kind: 'updateTask', id, title })));
          setBusy(false);
          if (ok) useUi.setState({ renameTaskIds: [] });
        }}
      >
        <label className="move-label" htmlFor="batch-title">
          New task title
        </label>
        <input
          id="batch-title"
          autoFocus
          autoComplete="off"
          value={value}
          disabled={busy}
          onChange={(e) => setValue(e.target.value)}
        />
        {error && <p role="alert">{error}</p>}
        <div className="dialog-actions">
          <button
            type="button"
            disabled={busy}
            onClick={() => useUi.setState({ renameTaskIds: [] })}
          >
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={busy}>
            Rename all
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function TaskDialogs() {
  const ui = useUi(),
    data = useApp((s) => s.data),
    tasks = data.tasks;
  const deleting = tasks.filter((t) => ui.deleteTaskIds.includes(t.id));
  const moving = tasks.filter((t) => ui.moveTaskIds.includes(t.id));
  const purge = ui.purge;
  const purging = purge
    ? tasks.filter((t) => t.listId === purge.listId && t.isCompleted === purge.completed)
    : [];
  return (
    <>
      {ui.deleteTaskId && (
        <Confirm
          title={deleting.length > 1 ? `Delete ${deleting.length} tasks?` : 'Delete task?'}
          message={`Permanently delete ${deleting.length > 1 ? `${deleting.length} selected tasks` : deleting[0] ? `“${deleting[0].title}”` : 'this task'}, their subtasks, notes, and attached images?`}
          onClose={() => useUi.getState().requestDelete(null)}
          onConfirm={async () => {
            const removed = branches(tasks, ui.deleteTaskIds);
            const ok = await deleteSelection(ui.deleteTaskIds);
            if (ok) {
              const next = tasks.find(
                (t) => !removed.has(t.id) && t.listId === deleting[0]?.listId,
              );
              if (next) focusTarget({ kind: 'row', id: next.id });
              else requestAnimationFrame(() => document.getElementById('new-task')?.focus());
            }
            return ok;
          }}
        />
      )}
      {ui.moveTaskId && moving.length > 0 && (
        <MoveDialog key={ui.moveTaskIds.join(',')} tasks={moving} />
      )}
      {ui.renameTaskIds.length > 0 && (
        <RenameDialog key={ui.renameTaskIds.join(',')} ids={ui.renameTaskIds} />
      )}
      {purge && (
        <Confirm
          title={`Purge ${purge.completed ? 'completed' : 'incomplete'} tasks?`}
          message={`Permanently delete ${purging.length} ${purge.completed ? 'completed' : 'incomplete'} tasks and their notes and images from “${data.lists.find((l) => l.id === purge.listId)?.name ?? 'this list'}”? ${purge.completed ? 'Incomplete' : 'Completed'} subtasks are kept and moved to their nearest surviving parent. Other lists are unchanged.`}
          onClose={() => useUi.setState({ purge: null })}
          onConfirm={async () => {
            if (!(await notes.flushAll())) return false;
            const current = appStore.getState().data.tasks;
            const removed = current.filter(
              (t) => t.listId === purge.listId && t.isCompleted === purge.completed,
            );
            const ok = await batch(purgeChanges(current, purge.listId, purge.completed));
            if (ok) removed.forEach((t) => notes.discard(t.id));
            return ok;
          }}
        />
      )}
    </>
  );
}
