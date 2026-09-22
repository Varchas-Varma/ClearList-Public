import type { KeyboardEvent } from 'react';
import { appStore } from '../state/app';
import { focusTarget, useTreeUi } from '../state/treeUi';
import { commandFor, commands } from '../settings/shortcuts';
import { runCommand } from '../settings/actions';
import { usePreferences } from '../settings/preferences';
import { children, moveTargets, rootSelection, siblings, targetKey, type Target } from '../tree';
import {
  handleRangeSelection,
  placeSelection,
  selectionFor,
  visibleTaskIds,
} from '../state/selection';
export function useTaskNavigation(search: boolean) {
  return function keyboard(e: KeyboardEvent<HTMLElement>) {
    if (
      e.defaultPrevented ||
      e.nativeEvent.isComposing ||
      !(e.target instanceof Element) ||
      e.target.closest('[role="menu"],dialog')
    )
      return;
    if (handleRangeSelection(e)) return;
    const command = commandFor(e, usePreferences.getState().hotkeys);
    const sourceElement = e.target;
    const row = sourceElement.closest<HTMLElement>('[data-task-id]')?.dataset.taskId;
    if (
      command &&
      commands.find((c) => c.id === command)?.scope === 'task' &&
      (row || sourceElement.closest('[data-gap]')) &&
      !sourceElement.closest('input,textarea,select,[contenteditable="true"]') &&
      (!sourceElement.closest('button') || sourceElement.closest('.editable-text,.drag-handle'))
    ) {
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat || ['moveTaskUp', 'moveTaskDown'].includes(command))
        runCommand(command, useTreeUi.getState().movingId ?? row, sourceElement);
      return;
    }
    const navigation: Record<string, string> = {
      previousItem: 'ArrowUp',
      nextItem: 'ArrowDown',
      firstItem: 'Home',
      lastItem: 'End',
      enterSubtasks: 'ArrowRight',
      leaveSubtasks: 'ArrowLeft',
      pickMove: 'Enter',
      cancel: 'Escape',
    };
    const key = command ? navigation[command] : undefined;
    if (e.key === 'Tab') useTreeUi.getState().setMoving(null);
    if (!key) return;
    const element = e.target;
    const input = element.closest(
      'input:not([type="checkbox"]),textarea,select,[contenteditable="true"]',
    );
    const rowId = element.closest<HTMLElement>('[data-task-id]')?.dataset.taskId;
    const { data, selectedListId } = appStore.getState();
    if (!selectedListId) return;
    const ui = useTreeUi.getState();
    const task = data.tasks.find((t) => t.id === rowId);
    const source = data.tasks.find((t) => t.id === ui.movingId);
    const arrow = key === 'ArrowUp' || key === 'ArrowDown';
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
      if (
        !arrow ||
        (!entry && !rowId) ||
        (!(e.ctrlKey || e.altKey || e.metaKey) && !['ArrowUp', 'ArrowDown'].includes(e.key))
      )
        return;
      handled();
      const visible = new Set(visibleTaskIds());
      const rows = siblings(data.tasks, selectedListId!, task?.parentId ?? null).filter((t) =>
        visible.has(t.id),
      );
      const index = task
        ? rows.findIndex((t) => t.id === task.id) + (key === 'ArrowUp' ? -1 : 1)
        : key === 'ArrowUp'
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
    if (auxiliary && !arrow && !['ArrowLeft', 'ArrowRight', 'Escape'].includes(key)) return;
    if (key === 'Escape') {
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
      const target = ui.target;
      if (!target) return;
      const hovered =
        target.kind === 'row' ? data.tasks.find((t) => t.id === target.id) : undefined;
      const scope = target.kind === 'gap' ? target.parentId : (hovered?.parentId ?? null);
      if (arrow || key === 'Home' || key === 'End') {
        handled();
        const targets = moveTargets(data.tasks, source, scope, selectionFor(source.id));
        const index = targets.findIndex((t) => targetKey(t) === targetKey(target));
        const next =
          key === 'Home'
            ? 0
            : key === 'End'
              ? targets.length - 1
              : Math.max(0, Math.min(targets.length - 1, index + (key === 'ArrowUp' ? -1 : 1)));
        focus(targets[next]);
      } else if (key === 'ArrowRight' && hovered) {
        handled();
        useTreeUi.getState().expand(hovered.id);
        focus(moveTargets(data.tasks, source, hovered.id, selectionFor(source.id))[0]);
      } else if (key === 'ArrowLeft' && scope) {
        handled();
        focus({ kind: 'row', id: scope });
      } else if (key === 'Enter') {
        handled();
        const parentId = target.kind === 'row' ? target.id : target.parentId;
        if (parentId) useTreeUi.getState().expand(parentId);
        useTreeUi.getState().setMoving(null);
        void placeSelection(selectionFor(source.id), {
          listId: source.listId,
          parentId,
          beforeId: target.kind === 'gap' ? target.beforeId : null,
          completed: target.kind === 'gap' ? target.completed : null,
        }).then((ok) => {
          if (ok) focus({ kind: 'row', id: source.id });
        });
      }
      return;
    }
    if (!task) return;
    const rows = search
      ? Array.from(document.querySelectorAll<HTMLElement>('.task-panel [data-task-id]'))
          .map((n) => data.tasks.find((t) => t.id === n.dataset.taskId)!)
          .filter(Boolean)
      : siblings(data.tasks, task.listId, task.parentId).filter((t) =>
          visibleTaskIds().includes(t.id),
        );
    if (arrow || key === 'Home' || key === 'End') {
      handled();
      const index = rows.findIndex((t) => t.id === task.id);
      const next =
        key === 'Home'
          ? 0
          : key === 'End'
            ? rows.length - 1
            : Math.max(0, Math.min(rows.length - 1, index + (key === 'ArrowUp' ? -1 : 1)));
      if (rows[next]) focus({ kind: 'row', id: rows[next].id });
    } else if (key === 'ArrowRight') {
      handled();
      useTreeUi.getState().expand(task.id);
      const child = children(data.tasks, task.id)[0];
      if (child && !search) focus({ kind: 'row', id: child.id });
    } else if (key === 'ArrowLeft') {
      handled();
      if (task.parentId && !search) focus({ kind: 'row', id: task.parentId });
      else if (children(data.tasks, task.id).length)
        useTreeUi.setState({ collapsed: { ...ui.collapsed, [task.id]: true } });
    } else if (key === 'Enter') {
      handled();
      if (search) {
        if (!appStore.getState().selectedTaskIds.includes(task.id))
          appStore.getState().selectTask(task.id);
        return;
      }
      if (!appStore.getState().selectedTaskIds.includes(task.id))
        appStore.getState().selectTask(task.id);
      const source = rootSelection(data.tasks, selectionFor(task.id))[0] ?? task;
      const group = siblings(data.tasks, source.listId, source.parentId, source.isCompleted);
      const index = group.findIndex((t) => t.id === source.id);
      const target: Target = {
        kind: 'gap',
        listId: source.listId,
        parentId: source.parentId,
        beforeId: group[index + 1]?.id ?? null,
        completed: source.parentId ? null : source.isCompleted,
      };
      const targets = moveTargets(data.tasks, source, source.parentId, selectionFor(source.id));
      const valid =
        targets.find((t) => targetKey(t) === targetKey(target)) ?? targets[targets.length - 1];
      useTreeUi.getState().setMoving(source.id, valid);
      focusTarget(valid);
    }
  };
}
