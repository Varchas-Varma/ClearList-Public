import { useEffect } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { appStore, notes } from '../state/app';
import { useUi } from '../state/ui';
import { clipboardImages, validateClipboardImage } from '../services/clipboard';
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
      const control = e.ctrlKey || e.metaKey;
      if (control && !e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        document.getElementById('search')?.focus();
        return;
      }
      if (control && !e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        if (e.shiftKey) document.getElementById('new-list')?.click();
        else {
          appStore.getState().setSearch('');
          requestAnimationFrame(() => document.getElementById('new-task')?.focus());
        }
        return;
      }
      if (e.key === 'Escape') {
        if (editable(e.target)) {
          (e.target as HTMLElement).blur();
          return;
        }
        appStore.getState().selectTask(null);
      }
      if (e.key === 'Delete' && !editable(e.target)) {
        const id = appStore.getState().selectedTaskId;
        if (id) {
          e.preventDefault();
          useUi.getState().requestDelete(id);
        }
      }
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
        else void appStore.getState().attach(id, file);
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
          if (closing) return;
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
