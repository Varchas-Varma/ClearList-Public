import { taskOrder, type Task } from './domain';

export type Place = {
  listId: string;
  parentId: string | null;
  beforeId: string | null;
  completed: boolean | null;
};
export type Target = { kind: 'row'; id: string } | ({ kind: 'gap' } & Place);
export function children(tasks: Task[], parentId: string): Task[] {
  return tasks
    .filter((t) => t.parentId === parentId)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}
export function branchIds(tasks: Task[], id: string): Set<string> {
  const result = new Set([id]);
  const byParent = new Map<string, string[]>();
  for (const task of tasks) {
    if (!task.parentId) continue;
    const group = byParent.get(task.parentId) ?? [];
    group.push(task.id);
    byParent.set(task.parentId, group);
  }
  for (const parent of result) for (const child of byParent.get(parent) ?? []) result.add(child);
  return result;
}
export function siblings(
  tasks: Task[],
  listId: string,
  parentId: string | null,
  completed?: boolean,
): Task[] {
  if (parentId) return children(tasks, parentId);
  if (completed !== undefined) return taskOrder(tasks, listId, completed);
  return [...taskOrder(tasks, listId, false), ...taskOrder(tasks, listId, true)];
}
export function targetKey(target: Target): string {
  return target.kind === 'row'
    ? `row:${target.id}`
    : `gap:${target.parentId ?? 'root'}:${target.beforeId ?? 'end'}:${String(target.completed)}`;
}
export function moveTargets(tasks: Task[], source: Task, parentId: string | null): Target[] {
  const excluded = branchIds(tasks, source.id);
  const rows = siblings(tasks, source.listId, parentId, source.isCompleted).filter(
    (t) => !excluded.has(t.id),
  );
  const place = {
    listId: source.listId,
    parentId,
    completed: parentId ? null : source.isCompleted,
  };
  return [
    ...rows.flatMap<Target>((t) => [
      { kind: 'gap', ...place, beforeId: t.id },
      { kind: 'row', id: t.id },
    ]),
    { kind: 'gap', ...place, beforeId: null },
  ];
}
export function canPlace(tasks: Task[], sourceId: string, place: Place): boolean {
  const source = tasks.find((t) => t.id === sourceId);
  if (!source || (place.completed !== null && source.isCompleted !== place.completed)) return false;
  const branch = branchIds(tasks, sourceId);
  return !branch.has(place.parentId ?? '') && !branch.has(place.beforeId ?? '');
}
