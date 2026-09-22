import { useEffect } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { appStore, notes } from '../state/app';
import { focusTarget, useTreeUi } from '../state/treeUi';
import { commandFor, commands } from '../settings/shortcuts';
import { usePreferences } from '../settings/preferences';
import { runCommand, revealTask } from '../settings/actions';
import { children } from '../tree';
import { clipboardImages, validateClipboardImage } from '../services/clipboard';
import { updateInProgress } from '../state/updater';
import { handleRangeSelection, selectionFor } from '../state/selection';
export function editable(target: EventTarget | null): boolean {
  return (
    target instanceof Element && !!target.closest('input,textarea,select,[contenteditable="true"]')
  );
}
export function useDesktop() {
  useEffect(() => {
    function keyboard(e: KeyboardEvent) {
      if (
        e.defaultPrevented ||
        e.isComposing ||
        document.querySelector('dialog[open]') ||
        document.querySelector('[role="menu"]')
      )
        return;
      if (handleRangeSelection(e)) return;
      const command = commandFor(e, usePreferences.getState().hotkeys);
      const element = e.target instanceof Element ? e.target : null;
      const typing = editable(e.target);
      if (
        command &&
        ['previousItem', 'nextItem'].includes(command) &&
        typing &&
        element?.closest('#task-detail') &&
        element.tagName === 'INPUT' &&
        (element.id === 'new-subtask' || element.closest('.inline-editor')) &&
        (!e.key || e.key.startsWith('Arrow') || e.ctrlKey || e.altKey)
      ) {
        const id = appStore.getState().selectedTaskId;
        if (id) {
          e.preventDefault();
          const rows = children(appStore.getState().data.tasks, id);
          const next =
            element.id === 'new-subtask'
              ? (rows[command === 'previousItem' ? rows.length - 1 : 0]?.id ?? id)
              : id;
          (element as HTMLElement).blur();
          revealTask(next);
          focusTarget({ kind: 'row', id: next });
        }
        return;
      }
      if ((command === 'cancel' && !typing) || e.key === 'Escape') {
        if (typing) {
          (e.target as HTMLElement).blur();
          return;
        }
        e.preventDefault();
        const source = useTreeUi.getState().movingId;
        useTreeUi.getState().setMoving(null);
        if (source) focusTarget({ kind: 'row', id: source });
        else {
          appStore.getState().selectTask(null);
          runCommand('newTask');
        }
        return;
      }
      const definition = commands.find((c) => c.id === command);
      if (!command || !definition || definition.scope === 'navigation') return;
      if (
        typing &&
        (definition.scope !== 'global' ||
          !(e.ctrlKey || e.altKey || e.metaKey || /^F\d{1,2}$/.test(e.key)))
      )
        return;
      if (definition.scope === 'task' && element?.closest('.sidebar')) return;
      if (
        !e.ctrlKey &&
        !e.altKey &&
        !e.metaKey &&
        ['Enter', ' '].includes(e.key) &&
        element?.closest('button,input')
      )
        return;
      if (e.repeat && !['moveTaskUp', 'moveTaskDown', 'previousList', 'nextList'].includes(command))
        return;
      e.preventDefault();
      const row =
        element?.closest<HTMLElement>('[data-task-id]')?.dataset.taskId ??
        useTreeUi.getState().hoveredId ??
        undefined;
      runCommand(command, useTreeUi.getState().movingId ?? row, element);
    }

    function paste(e: ClipboardEvent) {
      const id = appStore.getState().selectedTaskId;
      if (!id || !e.clipboardData || document.querySelector('dialog[open]')) return;
      if (editable(e.target) && !(e.target as Element).closest('#task-detail')) return;
      const files = clipboardImages(e.clipboardData);
      if (!files.length) return;
      e.preventDefault();
      for (const file of files) {
        const error = validateClipboardImage(file);
        if (error) appStore.getState().setError(error);
        else for (const taskId of selectionFor(id)) void appStore.getState().attach(taskId, file);
      }
    }
    function unload(e: BeforeUnloadEvent) {
      if (Object.keys(notes.store.getState().drafts).length || appStore.getState().pending) {
        e.preventDefault();
        void notes.flushAll();
      }
    }
    document.addEventListener('keydown', keyboard);
    document.addEventListener('paste', paste);
    window.addEventListener('beforeunload', unload);
    let unlisten: (() => void) | undefined,
      cancelled = false,
      closing = false;
    if (isTauri())
      void getCurrentWindow()
        .onCloseRequested(async (e) => {
          e.preventDefault();
          if (closing || updateInProgress()) return;
          closing = true;
          const failures = appStore.getState().writeFailures;
          (document.activeElement as HTMLElement | null)?.blur();
          if (await notes.flushAll()) {
            await appStore.getState().drain();
            if (appStore.getState().writeFailures !== failures) {
              appStore
                .getState()
                .setError('A change could not be saved. Review the error before closing.');
              closing = false;
              return;
            }
            try {
              await getCurrentWindow().destroy();
            } catch (error) {
              appStore.getState().setError(String(error));
              closing = false;
            }
          } else {
            appStore.getState().setError('Notes could not be saved. Retry saving before closing.');
            closing = false;
          }
        })
        .then((fn) => {
          if (cancelled) fn();
          else unlisten = fn;
        })
        .catch((error) =>
          appStore.getState().setError(`Could not prepare safe shutdown: ${String(error)}`),
        );
    return () => {
      cancelled = true;
      unlisten?.();
      document.removeEventListener('keydown', keyboard);
      document.removeEventListener('paste', paste);
      window.removeEventListener('beforeunload', unload);
    };
  }, []);
}
