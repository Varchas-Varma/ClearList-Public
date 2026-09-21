import {
  appVersion,
  checkForUpdates,
  checkOnLaunch,
  installUpdate,
  useUpdater,
  updateInProgress,
} from '../state/updater';
import { useUi } from '../state/ui';
import { useEffect } from 'react';
import { Modal } from './Modal';

export function UpdatesPanel() {
  const { phase, update, error } = useUpdater();
  return (
    <div id="panel-updates" role="tabpanel" aria-labelledby="tab-updates">
      <h3>Clearlist {appVersion}</h3>
      <p>
        Updates are checked automatically when Clearlist opens. You choose when to install and
        restart.
      </p>
      <p className="muted">
        Lists, notes, images, and settings stay on this PC. Checking for updates requires internet
        access.
      </p>
      <p role={error ? 'alert' : 'status'} className={error ? 'field-error' : ''}>
        {error ||
          (phase === 'checking'
            ? 'Checking for updates…'
            : update
              ? `Version ${update.version} is available.`
              : phase === 'current'
                ? 'You have the latest version.'
                : 'Ready to check for updates.')}
      </p>
      {update?.body && <pre className="update-notes">{update.body}</pre>}
      <div className="settings-footer">
        <button
          type="button"
          disabled={phase === 'checking' || updateInProgress()}
          onClick={() => void checkForUpdates()}
        >
          Check for updates
        </button>
        {update && (
          <button
            type="button"
            className="primary"
            onClick={() => useUpdater.setState({ confirmOpen: true })}
          >
            Install update…
          </button>
        )}
      </div>
    </div>
  );
}

export function UpdateNotice() {
  const { update, dismissed, confirmOpen, phase, progress, error } = useUpdater();
  useEffect(checkOnLaunch, []);
  const busy = updateInProgress();
  return (
    <>
      {update && !dismissed && !confirmOpen && (
        <div className="update-bar" role="status">
          <span>Clearlist {update.version} is available.</span>
          <button
            type="button"
            onClick={() => {
              useUpdater.setState({ dismissed: true });
              useUi.getState().openSettings('updates');
            }}
          >
            Review update
          </button>
          <button type="button" onClick={() => useUpdater.setState({ dismissed: true })}>
            Later
          </button>
        </div>
      )}
      {confirmOpen && update && (
        <Modal
          title="Install update?"
          canClose={!busy}
          onClose={() => {
            if (!busy) useUpdater.setState({ confirmOpen: false });
          }}
        >
          <p>
            Install Clearlist {update.version}? Pending edits will be saved, then the app will
            restart. Your lists and settings are kept.
          </p>
          {busy && (
            <div role="status">
              <p>
                {phase === 'installing'
                  ? 'Installing and restarting…'
                  : `Downloading update${progress === null ? '…' : `… ${progress}%`}`}
              </p>
              <progress aria-label="Update download" max={100} value={progress ?? undefined} />
            </div>
          )}
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <div className="settings-footer">
            <button
              type="button"
              disabled={busy}
              onClick={() => useUpdater.setState({ confirmOpen: false })}
            >
              Later
            </button>
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={() => void installUpdate()}
            >
              {busy ? 'Updating…' : 'Install and restart'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
