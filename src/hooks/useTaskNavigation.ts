import type { KeyboardEvent } from 'react';
import { appStore, notes } from '../state/app';
import { focusTarget, useTreeUi } from '../state/treeUi';
import { useUi } from '../state/ui';
import { children, moveTargets, siblings, targetKey, type Target } from '../tree';
export function useTaskNavigation(search: boolean) {
  return function keyboard(e: KeyboardEvent<HTMLElement>) {
    if (
      e.defaultPrevented ||
      e.nativeEvent.isComposing ||
      !(e.target instanceof Element) ||
      e.target.closest('[role="menu"],dialog')
    )
      return;
    const control = e.ctrlKey || e.metaKey;
    const element = e.target;
    const input = element.closest(
      'input:not([type="checkbox"]),textarea,select,[contenteditable="true"]',
    );
    const rowId = element.closest<HTMLElement>('[data-task-id]')?.dataset.taskId;
    const { data, selectedListId, mutate } = appStore.getState();
    if (!selectedListId) return;
    const ui = useTreeUi.getState();
    const task = data.tasks.find((t) => t.id === rowId);
    const source = data.tasks.find((t) => t.id === ui.movingId);
    const arrow = e.key === 'ArrowUp' || e.key === 'ArrowDown';
    const entry = element.id === 'new-task';
    function handled() {
      e.preventDefault();
      e.stopPropagation();
    }
    function focus(target: Target) {
      useTreeUi.getState().setTarget(target);
      focusTarget(target);
    }
    if (input) {
      if (!arrow || control || e.altKey || e.shiftKey || (!entry && !rowId)) return;
      handled();
      const rows = siblings(data.tasks, selectedListId!, task?.parentId ?? null);
      const index = task
        ? rows.findIndex((t) => t.id === task.id) + (e.key === 'ArrowUp' ? -1 : 1)
        : e.key === 'ArrowUp'
          ? rows.length - 1
          : 0;
      if (rows.length) {
        (input as HTMLElement).blur();
        focus({ kind: 'row', id: rows[Math.max(0, Math.min(rows.length - 1, index))].id });
      }
      return;
    }
    if (!rowId && !element.closest('[data-gap]')) return;
    // Buttons and checkboxes keep their standard activation; the title and handle operate the row.
    const auxiliary =
      element.closest('button,input') && !element.closest('.editable-text,.drag-handle');
    if (auxiliary && !arrow && !['ArrowLeft', 'ArrowRight', 'Escape'].includes(e.key)) return;
    if (e.key === 'Escape') {
      handled();
      if (source) {
        useTreeUi.getState().setMoving(null);
        focus({ kind: 'row', id: source.id });
      } else {
        appStore.getState().selectTask(null);
        document.getElementById('new-task')?.focus();
      }
      return;
    }
    if (source) {
      if (e.key === 'Tab') {
        useTreeUi.getState().setMoving(null);
        return;
      }
      if (control || e.altKey || e.shiftKey) return;
      const target = ui.target;
      if (!target) return;
      const hovered =
        target.kind === 'row' ? data.tasks.find((t) => t.id === target.id) : undefined;
      const scope = target.kind === 'gap' ? target.parentId : (hovered?.parentId ?? null);
      if (arrow || e.key === 'Home' || e.key === 'End') {
        handled();
        const targets = moveTargets(data.tasks, source, scope);
        const index = targets.findIndex((t) => targetKey(t) === targetKey(target));
        const next =
          e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? targets.length - 1
              : Math.max(0, Math.min(targets.length - 1, index + (e.key === 'ArrowUp' ? -1 : 1)));
        focus(targets[next]);
      } else if (e.key === 'ArrowRight' && hovered) {
        handled();
        useTreeUi.getState().expand(hovered.id);
        focus(moveTargets(data.tasks, source, hovered.id)[0]);
      } else if (e.key === 'ArrowLeft' && scope) {
        handled();
        focus({ kind: 'row', id: scope });
      } else if (e.key === 'Enter') {
        handled();
        const parentId = target.kind === 'row' ? target.id : target.parentId;
        if (parentId) useTreeUi.getState().expand(parentId);
        useTreeUi.getState().setMoving(null);
        void mutate({
          kind: 'placeTask',
          id: source.id,
          listId: source.listId,
          parentId,
          beforeId: target.kind === 'gap' ? target.beforeId : null,
        }).then((ok) => {
          if (ok) focus({ kind: 'row', id: source.id });
        });
      }
      return;
    }
    if (!task) return;
    if (e.key === 'Enter' && control) {
      handled();
      appStore.getState().selectTask(task.id);
      requestAnimationFrame(() => document.getElementById('task-detail')?.focus());
      return;
    }
    if (control && e.key.toLowerCase() === 'd') {
      handled();
      void (async () => {
        if (!(await notes.flushAll())) return;
        const newId = crypto.randomUUID();
        if (await mutate({ kind: 'duplicateTask', id: task.id, newId })) {
          appStore.getState().selectTask(newId);
          focus({ kind: 'row', id: newId });
        }
      })();
      return;
    }
    if (control || e.altKey || e.shiftKey) return;
    const rows = search
      ? Array.from(document.querySelectorAll<HTMLElement>('.task-panel [data-task-id]'))
          .map((n) => data.tasks.find((t) => t.id === n.dataset.taskId)!)
          .filter(Boolean)
      : siblings(data.tasks, task.listId, task.parentId);
    if (arrow || e.key === 'Home' || e.key === 'End') {
      handled();
      const index = rows.findIndex((t) => t.id === task.id);
      const next =
        e.key === 'Home'
          ? 0
          : e.key === 'End'
            ? rows.length - 1
            : Math.max(0, Math.min(rows.length - 1, index + (e.key === 'ArrowUp' ? -1 : 1)));
      if (rows[next]) focus({ kind: 'row', id: rows[next].id });
    } else if (e.key === 'ArrowRight') {
      handled();
      useTreeUi.getState().expand(task.id);
      const child = children(data.tasks, task.id)[0];
      if (child && !search) focus({ kind: 'row', id: child.id });
    } else if (e.key === 'ArrowLeft') {
      handled();
      if (task.parentId && !search) focus({ kind: 'row', id: task.parentId });
      else if (children(data.tasks, task.id).length)
        useTreeUi.setState({ collapsed: { ...ui.collapsed, [task.id]: true } });
    } else if (e.key === 'Enter') {
      handled();
      if (search) {
        appStore.getState().selectTask(task.id);
        return;
      }
      const group = siblings(data.tasks, task.listId, task.parentId, task.isCompleted);
      const index = group.findIndex((t) => t.id === task.id);
      const target: Target = {
        kind: 'gap',
        listId: task.listId,
        parentId: task.parentId,
        beforeId: group[index + 1]?.id ?? null,
        completed: task.parentId ? null : task.isCompleted,
      };
      useTreeUi.getState().setMoving(task.id, target);
      focusTarget(target);
    } else if (e.key === 'F2') {
      handled();
      useTreeUi.getState().setEditing(task.id);
    } else if (e.key === 'Delete') {
      handled();
      useUi.getState().requestDelete(task.id);
    } else if (e.key === ' ') {
      handled();
      void mutate({ kind: 'completeTask', id: task.id, completed: !task.isCompleted }).then(() =>
        focus({ kind: 'row', id: task.id }),
      );
    } else if (e.key === 'Insert') {
      handled();
      appStore.getState().selectTask(task.id);
      requestAnimationFrame(() => document.getElementById('new-subtask')?.focus());
    }
  };
}
