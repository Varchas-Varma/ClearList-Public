export interface List {
  id: string;
  name: string;
  position: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface Task {
  id: string;
  listId: string;
  parentId: string | null;
  title: string;
  notes: string;
  isCompleted: boolean;
  isImportant: boolean;
  position: number;
  completedPosition: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}
export interface Step {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}
export interface Attachment {
  id: string;
  taskId: string;
  fileName: string;
  storedPath: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
}
export interface Snapshot {
  lists: List[];
  tasks: Task[];
  steps: Step[];
  attachments: Attachment[];
  warning: string | null;
}
export const emptySnapshot = (): Snapshot => ({
  lists: [],
  tasks: [],
  steps: [],
  attachments: [],
  warning: null,
});
export type Mutation =
  | { kind: 'batch'; changes: Mutation[] }
  | { kind: 'createList'; id: string; name: string }
  | { kind: 'renameList'; id: string; name: string }
  | { kind: 'deleteList'; id: string }
  | { kind: 'reorderLists'; ids: string[] }
  | { kind: 'createTask'; id: string; listId: string; title: string }
  | { kind: 'updateTask'; id: string; title?: string; notes?: string; important?: boolean }
  | { kind: 'completeTask'; id: string; completed: boolean }
  | { kind: 'deleteTask'; id: string }
  | { kind: 'duplicateTask'; id: string; newId: string }
  | { kind: 'moveTask'; id: string; listId: string }
  | {
      kind: 'placeTask';
      id: string;
      listId: string;
      parentId: string | null;
      beforeId: string | null;
    }
  | { kind: 'reorderTasks'; listId: string; completed: boolean; ids: string[] }
  | { kind: 'createStep'; id: string; taskId: string; title: string }
  | { kind: 'updateStep'; id: string; title?: string; completed?: boolean }
  | { kind: 'deleteStep'; id: string }
  | { kind: 'reorderSteps'; taskId: string; ids: string[] }
  | { kind: 'deleteAttachment'; id: string };
export function cleanTitle(value: string): string {
  const title = value.trim();
  if (!title || [...title].length > 500)
    throw new Error('Enter a title between 1 and 500 characters.');
  return title;
}
export function taskOrder(tasks: Task[], listId: string, completed: boolean): Task[] {
  return tasks
    .filter((t) => t.listId === listId && !t.parentId && t.isCompleted === completed)
    .sort(
      (a, b) =>
        (completed ? a.completedPosition - b.completedPosition : a.position - b.position) ||
        a.id.localeCompare(b.id),
    );
}
export function searchTasks(data: Snapshot, query: string): Task[] {
  const text = query.trim().toLocaleLowerCase();
  if (!text) return [];
  const steps = new Set(
    data.steps.filter((s) => s.title.toLocaleLowerCase().includes(text)).map((s) => s.taskId),
  );
  return data.tasks.filter(
    (t) =>
      t.title.toLocaleLowerCase().includes(text) ||
      t.notes.toLocaleLowerCase().includes(text) ||
      steps.has(t.id),
  );
}
