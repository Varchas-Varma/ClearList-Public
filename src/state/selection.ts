import type { Mutation, Task } from '../domain';
import { branches, canPlaceMany, orderedTasks, rootSelection, siblings, type Place } from '../tree';
import { appStore, notes } from './app';
import { focusTarget, useTreeUi } from './treeUi';
import { usePreferences } from '../settings/preferences';
import { selectionHeld, type KeyEvent } from '../settings/shortcuts';

export function selectionFor(id?: string | null): string[] {
  const state = appStore.getState();
  const selected = state.selectedTaskIds.filter((value) =>
    state.data.tasks.some((t) => t.id === value),
  );
  if (id && !selected.includes(id)) return [id];
  return selected.length ? selected : id ? [id] : [];
}
export function visibleTaskIds(): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.task-panel [data-task-id]')).map(
    (n) => n.dataset.taskId!,
  );
}
export function toggleSelection(id: string) {
  const state = appStore.getState();
  const selected = new Set(state.selectedTaskIds);
  if (selected.has(id)) selected.delete(id);
  else selected.add(id);
  state.selectTasks(
    orderedTasks(
      state.data.tasks,
      state.data.lists.map((l) => l.id),
    )
      .filter((t) => selected.has(t.id))
      .map((t) => t.id),
    id,
  );
}
export function handleRangeSelection(
  e: KeyEvent & { target: EventTarget | null; preventDefault(): void; stopPropagation(): void },
): boolean {
  if (
    !selectionHeld(e, usePreferences.getState().hotkeys) ||
    !['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key) ||
    (e.target instanceof Element &&
      e.target.closest('input,textarea,select,[contenteditable="true"],dialog,[role="menu"]')) ||
    useTreeUi.getState().movingId
  )
    return false;
  const ids = visibleTaskIds();
  const state = appStore.getState();
  const focused =
    e.target instanceof Element
      ? e.target.closest<HTMLElement>('[data-task-id]')?.dataset.taskId
      : null;
  const current = focused ?? useTreeUi.getState().hoveredId ?? state.selectedTaskId;
  const index = ids.indexOf(current ?? '');
  if (index < 0) return false;
  const anchor =
    state.selectionAnchorId &&
    state.selectedTaskIds.includes(current!) &&
    ids.includes(state.selectionAnchorId)
      ? state.selectionAnchorId
      : current!;
  const next =
    e.key === 'Home'
      ? 0
      : e.key === 'End'
        ? ids.length - 1
        : Math.max(0, Math.min(ids.length - 1, index + (e.key === 'ArrowUp' ? -1 : 1)));
  const start = ids.indexOf(anchor);
  state.selectTasks(ids.slice(Math.min(start, next), Math.max(start, next) + 1), anchor);
  e.preventDefault();
  e.stopPropagation();
  useTreeUi.getState().setTarget({ kind: 'row', id: ids[next] });
  focusTarget({ kind: 'row', id: ids[next] });
  return true;
}
export function batch(changes: Mutation[]): Promise<boolean> {
  if (!changes.length) return Promise.resolve(true);
  return appStore.getState().mutate(changes.length === 1 ? changes[0] : { kind: 'batch', changes });
}
export function completeSelection(id: string, completed: boolean) {
  useTreeUi.setState({ completedOpen: true });
  return batch(selectionFor(id).map((id) => ({ kind: 'completeTask', id, completed })));
}
export function updateSelection(id: string, patch: { title?: string; important?: boolean }) {
  return batch(selectionFor(id).map((id) => ({ kind: 'updateTask', id, ...patch })));
}
export function addSubtasks(ids: string[], title: string) {
  ids.forEach((id) => useTreeUi.getState().expand(id));
  return batch(
    ids.map((taskId) => ({ kind: 'createStep', id: crypto.randomUUID(), taskId, title })),
  );
}
export function placeSelection(ids: string[], place: Place) {
  const { data } = appStore.getState();
  if (!canPlaceMany(data.tasks, ids, place)) return Promise.resolve(false);
  if (place.parentId) useTreeUi.getState().expand(place.parentId);
  const before = data.tasks.find((t) => t.id === place.beforeId);
  return batch(
    rootSelection(data.tasks, ids).map((t) => ({
      kind: 'placeTask',
      id: t.id,
      listId: place.listId,
      parentId: place.parentId,
      beforeId: place.parentId || before?.isCompleted === t.isCompleted ? place.beforeId : null,
    })),
  );
}
export async function deleteSelection(ids: string[]) {
  const { data } = appStore.getState();
  const roots = rootSelection(data.tasks, ids);
  const removed = branches(data.tasks, ids);
  for (const id of removed) if (!(await notes.flush(id))) return false;
  const ok = await batch(roots.map((t) => ({ kind: 'deleteTask', id: t.id })));
  if (ok) removed.forEach(notes.discard);
  return ok;
}
export function moveSelectionBy(id: string, direction: -1 | 1) {
  const { data } = appStore.getState();
  const selected = rootSelection(data.tasks, selectionFor(id));
  const groups = new Map<string, Task[]>();
  for (const t of selected)
    groups.set(
      `${t.listId}:${t.parentId ?? t.isCompleted}`,
      siblings(data.tasks, t.listId, t.parentId, t.isCompleted),
    );
  const selectedIds = new Set(selected.map((t) => t.id));
  const changes: Mutation[] = [];
  for (const rows of groups.values()) {
    const order = rows.map((t) => t.id);
    const indices = direction === -1 ? order.map((_, i) => i) : order.map((_, i) => i).reverse();
    for (const i of indices) {
      const j = i + direction;
      if (selectedIds.has(order[i]) && j >= 0 && j < order.length && !selectedIds.has(order[j]))
        [order[i], order[j]] = [order[j], order[i]];
    }
    const first = rows[0];
    if (first)
      changes.push(
        first.parentId
          ? { kind: 'reorderSteps', taskId: first.parentId, ids: order }
          : {
              kind: 'reorderTasks',
              listId: first.listId,
              completed: first.isCompleted,
              ids: order,
            },
      );
  }
  return batch(changes);
}

// Remove only tasks of the requested status. Surviving descendants are promoted in place.
export function purgeChanges(tasks: Task[], listId: string, completed: boolean): Mutation[] {
  const ordered = orderedTasks(tasks, [listId]);
  const removed = new Set(ordered.filter((t) => t.isCompleted === completed).map((t) => t.id));
  if (!removed.size) return [];
  const byId = new Map(tasks.map((t) => [t.id, t]));
  function survivingParent(task: Task) {
    let parent = task.parentId;
    while (parent && removed.has(parent)) parent = byId.get(parent)?.parentId ?? null;
    return parent;
  }
  const changes: Mutation[] = [];
  const survivors = ordered.filter((t) => !removed.has(t.id));
  for (const t of survivors)
    if (t.parentId && removed.has(t.parentId))
      changes.push({
        kind: 'placeTask',
        id: t.id,
        listId,
        parentId: survivingParent(t),
        beforeId: null,
      });
  for (const t of [...ordered].reverse())
    if (removed.has(t.id)) changes.push({ kind: 'deleteTask', id: t.id });
  const groups = new Map<string | null, string[]>();
  for (const t of survivors) {
    const parent = survivingParent(t);
    groups.set(parent, [...(groups.get(parent) ?? []), t.id]);
  }
  for (const [parent, ids] of groups)
    changes.push(
      parent
        ? { kind: 'reorderSteps', taskId: parent, ids }
        : { kind: 'reorderTasks', listId, completed: !completed, ids },
    );
  return changes;
}
