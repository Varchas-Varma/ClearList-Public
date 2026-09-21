import { appStore, notes } from '../state/app';
import { useUi } from '../state/ui';
import { focusTarget, useTreeUi } from '../state/treeUi';
import { usePreferences } from './preferences';
import { reorder } from '../dnd/actions';
import { siblings } from '../tree';
import type { CommandId } from './shortcuts';
import { checkForUpdates } from '../state/updater';

function nextFrame(action: () => void) {
  requestAnimationFrame(action);
}
export function expandSidebar() {
  usePreferences.getState().update({ sidebarCollapsed: false });
}
export function revealTask(id: string) {
  const { data } = appStore.getState();
  let task = data.tasks.find((t) => t.id === id);
  const seen = new Set<string>();
  while (task?.parentId && !seen.has(task.id)) {
    seen.add(task.id);
    useTreeUi.getState().expand(task.parentId);
    task = data.tasks.find((t) => t.id === task?.parentId);
  }
  if (task?.isCompleted) useTreeUi.setState({ completedOpen: true });
}
export function runCommand(command: CommandId, taskId?: string, target?: Element | null): void {
  const state = appStore.getState(),
    { data, mutate } = state;
  const id = taskId ?? useTreeUi.getState().movingId ?? state.selectedTaskId;
  const task = data.tasks.find((t) => t.id === id);
  const list = data.lists.find((l) => l.id === state.selectedListId);
  useTreeUi.getState().setMoving(null);
  function details(focus: string) {
    if (!task) return;
    state.selectTask(task.id);
    nextFrame(() => document.getElementById(focus)?.focus());
  }
  switch (command) {
    case 'newTask':
      state.setSearch('');
      nextFrame(() => document.getElementById('new-task')?.focus());
      break;
    case 'search':
      expandSidebar();
      nextFrame(() => document.getElementById('search')?.focus());
      break;
    case 'newList':
      expandSidebar();
      nextFrame(() => document.getElementById('new-list')?.click());
      break;
    case 'settings':
      useUi.getState().openSettings();
      break;
    case 'checkUpdates':
      useUi.getState().openSettings('updates');
      void checkForUpdates();
      break;
    case 'toggleSidebar':
      usePreferences.getState().toggleSidebar();
      break;
    case 'focusTasks':
      nextFrame(() => {
        const first = document.querySelector<HTMLElement>('.task-panel [data-task-id]');
        if (first) first.focus();
        else document.getElementById('new-task')?.focus();
      });
      break;
    case 'focusLists':
      expandSidebar();
      nextFrame(() =>
        document.querySelector<HTMLElement>('.list-row.selected .editable-text')?.focus(),
      );
      break;
    case 'clearSearch':
      state.setSearch('');
      nextFrame(() => document.getElementById('new-task')?.focus());
      break;
    case 'toggleCompleted':
      useTreeUi.setState({ completedOpen: !useTreeUi.getState().completedOpen });
      break;
    case 'expandAll':
      useTreeUi.setState({ collapsed: {} });
      break;
    case 'collapseAll':
      useTreeUi.setState({ collapsed: Object.fromEntries(data.tasks.map((t) => [t.id, true])) });
      break;
    case 'saveNotes':
      void notes.flushAll();
      break;
    case 'previousList':
    case 'nextList': {
      const index = data.lists.findIndex((l) => l.id === state.selectedListId);
      const next =
        data.lists[
          Math.max(0, Math.min(data.lists.length - 1, index + (command === 'nextList' ? 1 : -1)))
        ];
      if (next) state.selectList(next.id);
      break;
    }
    case 'defaultList': {
      const list = data.lists.find((l) => l.isDefault);
      if (list) state.selectList(list.id);
      break;
    }
    case 'renameList':
      if (list && !list.isDefault) {
        expandSidebar();
        useUi.setState({ editingListId: list.id });
      }
      break;
    case 'deleteList':
      if (list && !list.isDefault) {
        expandSidebar();
        useUi.setState({ deletingListId: list.id });
      }
      break;
    case 'moveListUp':
    case 'moveListDown': {
      if (!list || list.isDefault) break;
      const lists = data.lists.filter((l) => !l.isDefault),
        index = lists.findIndex((l) => l.id === list.id),
        other = lists[index + (command === 'moveListUp' ? -1 : 1)];
      if (other) reorder({ kind: 'list', id: list.id, label: list.name }, other.id);
      break;
    }
    case 'listMenu':
      expandSidebar();
      nextFrame(() =>
        document
          .querySelector<HTMLButtonElement>(`.list-row.selected [aria-haspopup="menu"]`)
          ?.click(),
      );
      break;
    case 'closeDetails':
      state.selectTask(null);
      if (task) {
        revealTask(task.id);
        focusTarget({ kind: 'row', id: task.id });
      }
      break;
    case 'details':
      details('task-detail');
      break;
    case 'focusNotes':
      details('task-notes');
      break;
    case 'newSubtask':
      if (task) useTreeUi.getState().expand(task.id);
      details('new-subtask');
      break;
    case 'focusImages':
      details('task-images');
      break;
    case 'previewImage':
    case 'deleteImage': {
      if (!task) break;
      const tile = target?.closest<HTMLElement>('[data-attachment-id]');
      state.selectTask(task.id);
      nextFrame(() => {
        const current =
          tile ?? document.querySelector<HTMLElement>('#task-detail [data-attachment-id]');
        current
          ?.querySelector<HTMLButtonElement>(
            command === 'previewImage' ? '.thumbnail' : '[data-delete-image]',
          )
          ?.click();
      });
      break;
    }
    case 'renameTask':
      if (!task) break;
      if (target?.closest('#task-detail'))
        document.querySelector<HTMLButtonElement>('#task-detail .detail-title-text')?.click();
      else {
        revealTask(task.id);
        useTreeUi.getState().setEditing(task.id);
      }
      break;
    case 'deleteTask':
      if (task) useUi.getState().requestDelete(task.id);
      break;
    case 'completeTask':
      if (task) {
        useTreeUi.setState({ completedOpen: true });
        void mutate({ kind: 'completeTask', id: task.id, completed: !task.isCompleted }).then(
          () => {
            revealTask(task.id);
            focusTarget({ kind: 'row', id: task.id });
          },
        );
      }
      break;
    case 'importantTask':
      if (task) void mutate({ kind: 'updateTask', id: task.id, important: !task.isImportant });
      break;
    case 'moveToList':
      if (task) useUi.getState().requestMove(task.id);
      break;
    case 'promoteTask':
      if (task)
        void mutate({
          kind: 'placeTask',
          id: task.id,
          listId: task.listId,
          parentId: null,
          beforeId: null,
        }).then((ok) => {
          if (ok) focusTarget({ kind: 'row', id: task.id });
        });
      break;
    case 'toggleSubtasks':
      if (task) useTreeUi.getState().toggle(task.id);
      break;
    case 'taskMenu':
      if (task) {
        revealTask(task.id);
        nextFrame(() =>
          document
            .getElementById(`task-${task.id}`)
            ?.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')
            ?.click(),
        );
      }
      break;
    case 'moveTaskUp':
    case 'moveTaskDown': {
      if (!task || state.search.trim()) break;
      const group = siblings(data.tasks, task.listId, task.parentId, task.isCompleted),
        index = group.findIndex((t) => t.id === task.id),
        other = group[index + (command === 'moveTaskUp' ? -1 : 1)];
      if (other)
        reorder(
          {
            kind: 'task',
            id: task.id,
            label: task.title,
            listId: task.listId,
            completed: task.isCompleted,
          },
          other.id,
        );
      break;
    }
    case 'duplicateTask':
      if (task)
        void (async () => {
          if (!(await notes.flushAll())) return;
          const newId = crypto.randomUUID();
          if (await mutate({ kind: 'duplicateTask', id: task.id, newId })) {
            state.selectTask(newId);
            revealTask(newId);
            focusTarget({ kind: 'row', id: newId });
          }
        })();
      break;
  }
}
