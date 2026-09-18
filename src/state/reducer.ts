import { cleanTitle, type Mutation, type Snapshot, taskOrder } from '../domain';
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
    case 'deleteTask':
      next.tasks = next.tasks.filter((t) => t.id !== change.id);
      break;
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
      if (task && task.listId !== change.listId) {
        task.position = next.tasks.filter((t) => t.listId === change.listId).length;
        task.completedPosition = taskOrder(next.tasks, change.listId, true).length;
        task.listId = change.listId;
      }
      break;
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
    case 'createStep':
      next.steps.push({
        id: change.id,
        taskId: change.taskId,
        title: cleanTitle(change.title),
        isCompleted: false,
        position: next.steps.filter((s) => s.taskId === change.taskId).length,
        ...stamp,
      });
      break;
    case 'updateStep':
      next.steps = next.steps.map((s) =>
        s.id === change.id
          ? {
              ...s,
              title: change.title === undefined ? s.title : cleanTitle(change.title),
              isCompleted: change.completed ?? s.isCompleted,
            }
          : s,
      );
      break;
    case 'deleteStep':
      next.steps = next.steps.filter((s) => s.id !== change.id);
      break;
    case 'reorderSteps':
      next.steps.forEach((s) => {
        if (s.taskId === change.taskId && change.ids.includes(s.id))
          s.position = change.ids.indexOf(s.id);
      });
      break;
    case 'deleteAttachment':
      next.attachments = next.attachments.filter((a) => a.id !== change.id);
      break;
  }
  const taskIds = new Set(next.tasks.map((t) => t.id));
  next.steps = next.steps.filter((s) => taskIds.has(s.taskId));
  next.attachments = next.attachments.filter((a) => taskIds.has(a.taskId));
  next.lists
    .sort((a, b) => a.position - b.position)
    .forEach((l, i) => {
      l.position = i;
    });
  for (const list of next.lists) {
    next.tasks
      .filter((t) => t.listId === list.id)
      .sort((a, b) => a.position - b.position)
      .forEach((t, i) => {
        t.position = i;
      });
    taskOrder(next.tasks, list.id, true).forEach((t, i) => {
      t.completedPosition = i;
    });
  }
  const groups = new Map<string, typeof next.steps>();
  for (const s of next.steps) {
    const group = groups.get(s.taskId) ?? [];
    group.push(s);
    groups.set(s.taskId, group);
  }
  for (const group of groups.values())
    group
      .sort((a, b) => a.position - b.position)
      .forEach((s, i) => {
        s.position = i;
      });
  return next;
}
