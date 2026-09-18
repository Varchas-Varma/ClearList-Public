import { arrayMove } from '@dnd-kit/sortable';
import { taskOrder, type Mutation } from '../domain';
import { appStore } from '../state/app';
export type DragItem =
  | { kind: 'list'; id: string; label: string }
  | { kind: 'list-drop'; id: string; label: string }
  | { kind: 'task'; id: string; label: string; listId: string; completed: boolean }
  | { kind: 'step'; id: string; label: string; taskId: string };
export const dragId = (kind: string, id: string) => `${kind}:${id}`;
export function reorder(item: DragItem, targetId: string) {
  const { data, mutate } = appStore.getState();
  let ids: string[], change: Mutation;
  if (item.kind === 'list') {
    ids = data.lists.filter((l) => !l.isDefault).map((l) => l.id);
    change = { kind: 'reorderLists', ids };
  } else if (item.kind === 'task') {
    ids = taskOrder(data.tasks, item.listId, item.completed).map((t) => t.id);
    change = { kind: 'reorderTasks', listId: item.listId, completed: item.completed, ids };
  } else if (item.kind === 'step') {
    ids = data.steps
      .filter((s) => s.taskId === item.taskId)
      .sort((a, b) => a.position - b.position)
      .map((s) => s.id);
    change = { kind: 'reorderSteps', taskId: item.taskId, ids };
  } else return;
  const from = ids.indexOf(item.id),
    to = ids.indexOf(targetId);
  if (from >= 0 && to >= 0 && from !== to)
    void mutate({ ...change, ids: arrayMove(ids, from, to) });
}
