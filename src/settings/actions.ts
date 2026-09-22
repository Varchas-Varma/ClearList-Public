import { appStore, notes } from '../state/app';
import { useUi } from '../state/ui';
import { focusTarget, useTreeUi } from '../state/treeUi';
import { usePreferences } from './preferences';
import { reorder } from '../dnd/actions';
import { rootSelection } from '../tree';
import {
  batch,
  completeSelection,
  moveSelectionBy,
  selectionFor,
  toggleSelection,
  updateSelection,
  visibleTaskIds,
} from '../state/selection';
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
  const ids = selectionFor(id);
  const list = data.lists.find((l) => l.id === state.selectedListId);
  useTreeUi.getState().setMoving(null);
  function details(focus: string) {
    if (!task) return;
    if (!ids.includes(task.id) || ids.length < 2) state.selectTask(task.id);
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
    case 'toggleCompleted': {
      const completedOpen = !useTreeUi.getState().completedOpen;
      const focusHidden = !completedOpen && document.activeElement?.closest('.completed-section');
      useTreeUi.setState({ completedOpen });
      if (focusHidden) nextFrame(() => runCommand('focusTasks'));
      break;
    }
    case 'purgeCompleted':
    case 'purgeIncomplete':
      if (list)
        useUi.setState({ purge: { listId: list.id, completed: command === 'purgeCompleted' } });
      break;
    case 'toggleSelection':
      if (task) toggleSelection(task.id);
      break;
    case 'selectAllTasks':
      state.selectTasks(visibleTaskIds());
      break;
    case 'clearSelection':
      state.selectTask(null);
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
      ids.forEach((id) => useTreeUi.getState().expand(id));
      details('new-subtask');
      break;
    case 'focusImages':
      details('task-images');
      break;
    case 'previewImage':
    case 'deleteImage': {
      if (!task) break;
      const tile = target?.closest<HTMLElement>('[data-attachment-id]');
      if (ids.length < 2) state.selectTask(task.id);
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
      if (ids.length > 1) {
        useUi.setState({ renameTaskIds: ids });
        break;
      }
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
    case 'markCompleted':
    case 'markIncomplete':
      if (task) {
        const completed =
          command === 'markCompleted' ||
          (command === 'completeTask' &&
            !ids.every((id) => data.tasks.find((t) => t.id === id)?.isCompleted));
        void completeSelection(task.id, completed).then(() => {
          revealTask(task.id);
          focusTarget({ kind: 'row', id: task.id });
        });
      }
      break;
    case 'importantTask':
      if (task)
        void updateSelection(task.id, {
          important: !ids.every((id) => data.tasks.find((t) => t.id === id)?.isImportant),
        });
      break;
    case 'moveToList':
      if (task) useUi.getState().requestMove(task.id);
      break;
    case 'promoteTask':
      if (task)
        void batch(
          rootSelection(data.tasks, ids).map((t) => ({
            kind: 'placeTask',
            id: t.id,
            listId: t.listId,
            parentId: null,
            beforeId: null,
          })),
        ).then((ok) => {
          if (ok) focusTarget({ kind: 'row', id: task.id });
        });
      break;
    case 'toggleSubtasks':
      if (task) {
        const collapsed = !useTreeUi.getState().collapsed[task.id];
        useTreeUi.setState({
          collapsed: {
            ...useTreeUi.getState().collapsed,
            ...Object.fromEntries(ids.map((id) => [id, collapsed])),
          },
        });
      }
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
      void moveSelectionBy(task.id, command === 'moveTaskUp' ? -1 : 1);
      break;
    }
    case 'duplicateTask':
      if (task)
        void (async () => {
          if (!(await notes.flushAll())) return;
          const copies: string[] = [];
          for (const root of rootSelection(data.tasks, ids)) {
            const newId = crypto.randomUUID();
            if (!(await mutate({ kind: 'duplicateTask', id: root.id, newId }))) break;
            copies.push(newId);
          }
          if (copies.length) {
            state.selectTasks(copies);
            copies.forEach(revealTask);
            focusTarget({ kind: 'row', id: copies[0] });
          }
        })();
      break;
  }
}
