import { useState } from 'react';
import { branchIds } from '../tree';
import { focusTarget } from '../state/treeUi';
import type { Task } from '../domain';
import { appStore, notes, useApp } from '../state/app';
import { useUi } from '../state/ui';
import { Confirm } from './Confirm';
import { Modal } from './Modal';
function MoveDialog({ task }: { task: Task }) {
  const lists = useApp((s) => s.data.lists),
    [destination, setDestination] = useState(task.listId),
    [busy, setBusy] = useState(false);
  return (
    <Modal
      title="Move task"
      onClose={() => {
        if (!busy) useUi.getState().requestMove(null);
      }}
    >
      <label className="move-label" htmlFor="destination">
        Move “{task.title}” to
      </label>
      <select
        autoFocus
        id="destination"
        value={destination}
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
          disabled={busy || destination === task.listId}
          onClick={async () => {
            setBusy(true);
            const ok = await appStore
              .getState()
              .mutate({ kind: 'moveTask', id: task.id, listId: destination });
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
export function TaskDialogs() {
  const deletingId = useUi((s) => s.deleteTaskId),
    movingId = useUi((s) => s.moveTaskId),
    tasks = useApp((s) => s.data.tasks),
    deleting = tasks.find((t) => t.id === deletingId),
    moving = tasks.find((t) => t.id === movingId);
  return (
    <>
      {deletingId && (
        <Confirm
          title="Delete task?"
          message={`Permanently delete ${deleting ? `“${deleting.title}”` : 'this task'}, its subtasks, notes, and attached images?`}
          onClose={() => useUi.getState().requestDelete(null)}
          onConfirm={async () => {
            const removed = branchIds(tasks, deletingId);
            for (const id of removed) if (!(await notes.flush(id))) return false;
            const ok = await appStore.getState().mutate({ kind: 'deleteTask', id: deletingId });
            if (ok) {
              removed.forEach(notes.discard);
              const next = tasks.find((t) => !removed.has(t.id) && t.listId === deleting?.listId);
              if (next) focusTarget({ kind: 'row', id: next.id });
              else requestAnimationFrame(() => document.getElementById('new-task')?.focus());
            }
            return ok;
          }}
        />
      )}
      {moving && <MoveDialog key={moving.id} task={moving} />}
    </>
  );
}
