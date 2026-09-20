import { cleanTitle, type Mutation, type Snapshot, taskOrder } from '../domain';
import { branchIds } from '../tree';
export function optimistic(data: Snapshot, change: Mutation): Snapshot {
  const next = structuredClone(data),
    now = new Date().toISOString(),
    stamp = { createdAt: now, updatedAt: now };
  const task = 'id' in change ? next.tasks.find((t) => t.id === change.id) : undefined;
  switch (change.kind) {
    case 'createList':
      next.lists.push({
        id: change.id,
        name: cleanTitle(change.name),
        position: next.lists.length,
        isDefault: false,
        ...stamp,
      });
      break;
    case 'renameList':
      next.lists = next.lists.map((l) =>
        l.id === change.id ? { ...l, name: cleanTitle(change.name) } : l,
      );
      break;
    case 'deleteList':
      if (next.lists.find((l) => l.id === change.id)?.isDefault)
        throw new Error('The default list cannot be deleted.');
      next.lists = next.lists.filter((l) => l.id !== change.id);
      next.tasks = next.tasks.filter((t) => t.listId !== change.id);
      break;
    case 'reorderLists':
      next.lists.forEach((l) => {
        if (!l.isDefault && change.ids.includes(l.id)) l.position = change.ids.indexOf(l.id) + 1;
      });
      break;
    case 'createTask':
      next.tasks.push({
        id: change.id,
        listId: change.listId,
        parentId: null,
        title: cleanTitle(change.title),
        notes: '',
        isCompleted: false,
        isImportant: false,
        position: next.tasks.filter((t) => t.listId === change.listId).length,
        completedPosition: 0,
        completedAt: null,
        ...stamp,
      });
      break;
    case 'updateTask':
      if (task) {
        if (change.title !== undefined) task.title = cleanTitle(change.title);
        if (change.notes !== undefined) task.notes = change.notes;
        if (change.important !== undefined) task.isImportant = change.important;
      }
      break;
    case 'completeTask':
      if (task && task.isCompleted !== change.completed) {
        task.completedPosition = taskOrder(next.tasks, task.listId, true).length;
        task.isCompleted = change.completed;
        task.completedAt = change.completed ? now : null;
      }
      break;
    case 'deleteTask': {
      const removed = branchIds(next.tasks, change.id);
      next.tasks = next.tasks.filter((t) => !removed.has(t.id));
      break;
    }
    case 'duplicateTask':
      if (task)
        next.tasks.push({
          ...task,
          id: change.newId,
          isCompleted: false,
          completedAt: null,
          position: next.tasks.filter((t) => t.listId === task.listId).length,
          ...stamp,
        });
      break;
    case 'moveTask':
    case 'placeTask': {
      if (!task) break;
      const parentId = change.kind === 'placeTask' ? change.parentId : null;
      const beforeId = change.kind === 'placeTask' ? change.beforeId : null;
      const branch = branchIds(next.tasks, task.id);
      if (
        parentId &&
        (branch.has(parentId) ||
          !next.tasks.some((t) => t.id === parentId && t.listId === change.listId))
      )
        throw new Error('A task cannot be moved into itself or its subtasks.');
      if (
        beforeId &&
        !next.tasks.some(
          (t) =>
            t.id === beforeId &&
            t.id !== task.id &&
            t.listId === change.listId &&
            t.parentId === parentId &&
            (parentId !== null || t.isCompleted === task.isCompleted),
        )
      )
        throw new Error('The destination changed. Please try again.');
      const column = !parentId && task.isCompleted ? 'completedPosition' : 'position';
      const ordered = next.tasks
        .filter((t) => t.listId === change.listId && t.parentId === parentId && t.id !== task.id)
        .sort((a, b) => a[column] - b[column] || a.id.localeCompare(b.id));
      const index = beforeId ? ordered.findIndex((t) => t.id === beforeId) : ordered.length;
      task.position = Math.max(-1, ...ordered.map((t) => t.position)) + 1;
      task.completedPosition = Math.max(-1, ...ordered.map((t) => t.completedPosition)) + 1;
      task.parentId = parentId;
      for (const t of next.tasks) if (branch.has(t.id)) t.listId = change.listId;
      ordered.splice(index, 0, task);
      ordered.forEach((t, i) => {
        t[column] = i;
      });
      break;
    }
    case 'reorderTasks': {
      const column = change.completed ? 'completedPosition' : 'position';
      const slots = taskOrder(next.tasks, change.listId, change.completed).map((t) => t[column]);
      change.ids.forEach((id, i) => {
        const t = next.tasks.find(
          (t) => t.id === id && t.listId === change.listId && t.isCompleted === change.completed,
        );
        if (t && slots[i] !== undefined) t[column] = slots[i];
      });
      break;
    }
    case 'createStep': {
      const parent = next.tasks.find((t) => t.id === change.taskId);
      if (!parent) throw new Error('The parent task no longer exists.');
      next.tasks.push({
        id: change.id,
        listId: parent.listId,
        parentId: parent.id,
        title: cleanTitle(change.title),
        notes: '',
        isCompleted: false,
        isImportant: false,
        position: next.tasks.filter((t) => t.parentId === parent.id).length,
        completedPosition: 0,
        completedAt: null,
        ...stamp,
      });
      break;
    }
    case 'updateStep':
      if (task) {
        if (change.title !== undefined) task.title = cleanTitle(change.title);
        if (change.completed !== undefined) task.isCompleted = change.completed;
      }
      break;
    case 'deleteStep': {
      const removed = branchIds(next.tasks, change.id);
      next.tasks = next.tasks.filter((t) => !removed.has(t.id));
      break;
    }
    case 'reorderSteps':
      change.ids.forEach((id, i) => {
        const child = next.tasks.find((t) => t.id === id && t.parentId === change.taskId);
        if (child) child.position = i;
      });
      break;
    case 'deleteAttachment':
      next.attachments = next.attachments.filter((a) => a.id !== change.id);
      break;
  }
  const taskIds = new Set(next.tasks.map((t) => t.id));
  next.attachments = next.attachments.filter((a) => taskIds.has(a.taskId));
  next.lists
    .sort((a, b) => a.position - b.position)
    .forEach((l, i) => {
      l.position = i;
    });
  const groups = new Map<string, typeof next.tasks>();
  for (const t of next.tasks) {
    const key = `${t.listId}:${t.parentId ?? ''}`;
    const group = groups.get(key) ?? [];
    group.push(t);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    group
      .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
      .forEach((t, i) => {
        t.position = i;
      });
    group
      .filter((t) => t.isCompleted)
      .sort((a, b) => a.completedPosition - b.completedPosition || a.id.localeCompare(b.id))
      .forEach((t, i) => {
        t.completedPosition = i;
      });
  }
  next.steps = next.tasks
    .filter((t) => t.parentId)
    .map((t) => ({
      id: t.id,
      taskId: t.parentId!,
      title: t.title,
      isCompleted: t.isCompleted,
      position: t.position,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));
  return next;
}
