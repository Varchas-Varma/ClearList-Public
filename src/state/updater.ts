import { create } from 'zustand';
import { isTauri } from '@tauri-apps/api/core';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { releaseVersion } from '../../package.json';
import { appStore, notes } from './app';

export const appVersion = releaseVersion;
export function updateVersionLabel(update: Pick<Update, 'version' | 'rawJson'>): string {
  const label = update.rawJson?.releaseVersion;
  return typeof label === 'string' && /^\d+\.\d+\.\d+(?:\.\d+)?$/.test(label)
    ? label
    : update.version;
}
type Phase = 'idle' | 'checking' | 'available' | 'current' | 'downloading' | 'installing' | 'error';
export const useUpdater = create<{
  phase: Phase;
  update: Update | null;
  error: string | null;
  progress: number | null;
  dismissed: boolean;
  confirmOpen: boolean;
}>(() => ({
  phase: 'idle',
  update: null,
  error: null,
  progress: null,
  dismissed: false,
  confirmOpen: false,
}));

export function updateInProgress() {
  return ['downloading', 'installing'].includes(useUpdater.getState().phase);
}

let started = false;
export function checkOnLaunch() {
  if (started || !isTauri() || import.meta.env.DEV) return;
  started = true;
  void checkForUpdates();
}

export async function checkForUpdates() {
  if (updateInProgress() || useUpdater.getState().phase === 'checking') return;
  if (!isTauri()) {
    useUpdater.setState({
      phase: 'error',
      error: 'Updates are available in the desktop app.',
    });
    return;
  }
  useUpdater.setState({ phase: 'checking', error: null });
  try {
    const update = await check({ timeout: 15000 });
    const previous = useUpdater.getState().update;
    useUpdater.setState({ update, phase: update ? 'available' : 'current', dismissed: false });
    if (previous) void previous.close().catch(() => {});
  } catch {
    useUpdater.setState({
      phase: 'error',
      error:
        'Could not check for updates. Check your internet connection and try again. Your lists remain available offline.',
    });
  }
}

export async function installUpdate() {
  const update = useUpdater.getState().update;
  if (!update || updateInProgress()) return;
  const failures = appStore.getState().writeFailures;
  (document.activeElement as HTMLElement | null)?.blur();
  useUpdater.setState({ phase: 'downloading', error: null, progress: null });
  try {
    let downloaded = 0,
      total = 0;
    await update.download(
      (event) => {
        if (event.event === 'Started') {
          total = event.data.contentLength ?? 0;
          downloaded = 0;
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength;
          useUpdater.setState({
            progress: total ? Math.min(100, Math.round((downloaded / total) * 100)) : null,
          });
        }
      },
      { timeout: 120000 },
    );
    // The native installer exits the process. Flush edits after the verified download,
    // while the modal still prevents new edits, before allowing that exit.
    if (!(await notes.flushAll()))
      throw new Error('Notes could not be saved. Retry saving before updating.');
    await appStore.getState().drain();
    if (appStore.getState().writeFailures !== failures)
      throw new Error('A change could not be saved. Review the save error before updating.');
    useUpdater.setState({ phase: 'installing', progress: 100 });
    await update.install({ restartAfterInstall: true });
  } catch (error) {
    useUpdater.setState({
      phase: 'error',
      error: `Update was not installed. ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}
