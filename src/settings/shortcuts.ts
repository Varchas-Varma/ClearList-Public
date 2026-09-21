export const commands = [
  { id: 'newTask', label: 'Jump to Add a task', group: 'App', scope: 'global', key: 'Ctrl+N' },
  { id: 'search', label: 'Jump to task search', group: 'App', scope: 'global', key: 'Ctrl+F' },
  { id: 'newList', label: 'Jump to New list', group: 'App', scope: 'global', key: 'Ctrl+Shift+N' },
  { id: 'settings', label: 'Open settings', group: 'App', scope: 'global', key: null },
  { id: 'checkUpdates', label: 'Check for updates', group: 'App', scope: 'global', key: null },
  {
    id: 'toggleSidebar',
    label: 'Collapse / expand sidebar',
    group: 'App',
    scope: 'global',
    key: null,
  },
  { id: 'focusTasks', label: 'Jump to task list', group: 'App', scope: 'global', key: null },
  { id: 'focusLists', label: 'Jump to list sidebar', group: 'App', scope: 'global', key: null },
  { id: 'clearSearch', label: 'Clear search', group: 'App', scope: 'global', key: null },
  {
    id: 'toggleCompleted',
    label: 'Show / hide completed tasks',
    group: 'App',
    scope: 'global',
    key: null,
  },
  { id: 'expandAll', label: 'Expand all subtasks', group: 'App', scope: 'global', key: null },
  { id: 'collapseAll', label: 'Collapse all subtasks', group: 'App', scope: 'global', key: null },
  { id: 'saveNotes', label: 'Save pending notes now', group: 'App', scope: 'global', key: null },
  {
    id: 'previousItem',
    label: 'Previous task / move position',
    group: 'Navigation',
    scope: 'navigation',
    key: 'ArrowUp',
  },
  {
    id: 'nextItem',
    label: 'Next task / move position',
    group: 'Navigation',
    scope: 'navigation',
    key: 'ArrowDown',
  },
  {
    id: 'enterSubtasks',
    label: 'Enter subtasks',
    group: 'Navigation',
    scope: 'navigation',
    key: 'ArrowRight',
  },
  {
    id: 'leaveSubtasks',
    label: 'Return to parent level',
    group: 'Navigation',
    scope: 'navigation',
    key: 'ArrowLeft',
  },
  {
    id: 'firstItem',
    label: 'First task / move position',
    group: 'Navigation',
    scope: 'navigation',
    key: 'Home',
  },
  {
    id: 'lastItem',
    label: 'Last task / move position',
    group: 'Navigation',
    scope: 'navigation',
    key: 'End',
  },
  {
    id: 'pickMove',
    label: 'Pick up / drop task',
    group: 'Navigation',
    scope: 'navigation',
    key: 'Enter',
  },
  {
    id: 'cancel',
    label: 'Cancel move / return to Add a task',
    group: 'Navigation',
    scope: 'navigation',
    key: 'Escape',
  },
  { id: 'details', label: 'Open task details', group: 'Tasks', scope: 'task', key: 'Ctrl+Enter' },
  { id: 'renameTask', label: 'Rename task', group: 'Tasks', scope: 'task', key: 'F2' },
  { id: 'deleteTask', label: 'Delete task', group: 'Tasks', scope: 'task', key: 'Delete' },
  {
    id: 'completeTask',
    label: 'Complete / uncomplete task',
    group: 'Tasks',
    scope: 'task',
    key: 'Space',
  },
  { id: 'newSubtask', label: 'Add a subtask', group: 'Tasks', scope: 'task', key: 'Insert' },
  {
    id: 'duplicateTask',
    label: 'Duplicate task and subtasks',
    group: 'Tasks',
    scope: 'task',
    key: 'Ctrl+D',
  },
  {
    id: 'importantTask',
    label: 'Mark / unmark important',
    group: 'Tasks',
    scope: 'task',
    key: null,
  },
  {
    id: 'moveToList',
    label: 'Move task to another list',
    group: 'Tasks',
    scope: 'task',
    key: null,
  },
  {
    id: 'moveTaskUp',
    label: 'Move task up one position',
    group: 'Tasks',
    scope: 'task',
    key: null,
  },
  {
    id: 'moveTaskDown',
    label: 'Move task down one position',
    group: 'Tasks',
    scope: 'task',
    key: null,
  },
  { id: 'promoteTask', label: 'Make task top level', group: 'Tasks', scope: 'task', key: null },
  {
    id: 'toggleSubtasks',
    label: 'Collapse / expand task subtasks',
    group: 'Tasks',
    scope: 'task',
    key: null,
  },
  { id: 'taskMenu', label: 'Open task actions', group: 'Tasks', scope: 'task', key: null },
  { id: 'focusNotes', label: 'Jump to task notes', group: 'Tasks', scope: 'task', key: null },
  { id: 'closeDetails', label: 'Close task details', group: 'Tasks', scope: 'task', key: null },
  { id: 'previousList', label: 'Previous list', group: 'Lists', scope: 'global', key: null },
  { id: 'nextList', label: 'Next list', group: 'Lists', scope: 'global', key: null },
  {
    id: 'defaultList',
    label: 'Open default Tasks list',
    group: 'Lists',
    scope: 'global',
    key: null,
  },
  { id: 'renameList', label: 'Rename current list', group: 'Lists', scope: 'global', key: null },
  { id: 'deleteList', label: 'Delete current list', group: 'Lists', scope: 'global', key: null },
  { id: 'moveListUp', label: 'Move current list up', group: 'Lists', scope: 'global', key: null },
  {
    id: 'moveListDown',
    label: 'Move current list down',
    group: 'Lists',
    scope: 'global',
    key: null,
  },
  {
    id: 'listMenu',
    label: 'Open current list actions',
    group: 'Lists',
    scope: 'global',
    key: null,
  },
  { id: 'focusImages', label: 'Jump to task images', group: 'Images', scope: 'task', key: null },
  {
    id: 'previewImage',
    label: 'Preview focused / first image',
    group: 'Images',
    scope: 'task',
    key: null,
  },
  {
    id: 'deleteImage',
    label: 'Delete focused / first image',
    group: 'Images',
    scope: 'task',
    key: null,
  },
] as const;
export type CommandId = (typeof commands)[number]['id'];
export type Hotkeys = Record<CommandId, string | null>;
export const defaultHotkeys = () =>
  Object.fromEntries(commands.map((c) => [c.id, c.key])) as Hotkeys;
export type KeyEvent = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>;
export function keyBinding(e: KeyEvent): string | null {
  if (['Control', 'Alt', 'Shift', 'Meta', 'Dead', 'Unidentified', 'Process'].includes(e.key))
    return null;
  const key = e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.key;
  return [e.ctrlKey && 'Ctrl', e.metaKey && 'Meta', e.altKey && 'Alt', e.shiftKey && 'Shift', key]
    .filter(Boolean)
    .join('+');
}
export function commandFor(e: KeyEvent, hotkeys: Hotkeys): CommandId | undefined {
  const key = keyBinding(e);
  return key ? commands.find((c) => hotkeys[c.id] === key)?.id : undefined;
}
export function shortcutError(id: CommandId, binding: string, hotkeys: Hotkeys): string | null {
  const parts = binding.split('+');
  if (
    parts.includes('Tab') ||
    parts.includes('Meta') ||
    ['Alt+F4', 'Ctrl+Alt+Delete'].includes(binding)
  )
    return 'That combination is reserved for Windows or moving focus.';
  if (binding === 'Escape' && id !== 'cancel') return 'Escape is reserved for cancelling.';
  if (
    ['Ctrl+A', 'Ctrl+C', 'Ctrl+V', 'Ctrl+X', 'Ctrl+Z', 'Ctrl+Y', 'Ctrl+Shift+Z'].includes(binding)
  )
    return 'Keep this shortcut available for text editing and pasting images.';
  const other = commands.find((c) => c.id !== id && hotkeys[c.id] === binding);
  return other ? `Already assigned to “${other.label}”. Clear that assignment first.` : null;
}
export function keyLabel(binding: string | null | undefined): string {
  return (
    binding
      ?.replaceAll('ArrowUp', '↑')
      .replaceAll('ArrowDown', '↓')
      .replaceAll('ArrowLeft', '←')
      .replaceAll('ArrowRight', '→')
      .replaceAll('Escape', 'Esc') ?? 'Unassigned'
  );
}
