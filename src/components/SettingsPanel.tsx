import { useState } from 'react';
import { Palette as PaletteIcon, Keyboard, Download } from 'lucide-react';
import { useUi } from '../state/ui';
import { usePreferences } from '../settings/preferences';
import { commands, keyBinding, keyLabel, type CommandId } from '../settings/shortcuts';
import type { Palette } from '../settings/colours';
import { ColourPicker } from './ColourPicker';
import { Modal } from './Modal';
import { UpdatesPanel } from './Updates';
const tabs = ['appearance', 'hotkeys', 'updates'] as const;
export function SettingsPanel({ palette }: { palette: Palette }) {
  const tab = useUi((s) => s.settingsTab),
    hotkeys = usePreferences((s) => s.hotkeys),
    collapsed = usePreferences((s) => s.sidebarCollapsed),
    saveError = usePreferences((s) => s.saveError);
  const [recording, setRecording] = useState<CommandId | null>(null),
    [error, setError] = useState(''),
    [filter, setFilter] = useState('');
  const visible = commands.filter((c) =>
    `${c.label} ${c.group} ${keyLabel(hotkeys[c.id])}`.toLowerCase().includes(filter.toLowerCase()),
  );
  return (
    <Modal title="Settings" wide onClose={() => useUi.setState({ settingsOpen: false })}>
      <div className="settings-panel">
        <div className="settings-tabs" role="tablist" aria-label="Settings sections">
          {tabs.map((id) => (
            <button
              type="button"
              key={id}
              role="tab"
              id={`tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`panel-${id}`}
              tabIndex={tab === id ? 0 : -1}
              onClick={() => {
                useUi.setState({ settingsTab: id });
                setRecording(null);
                setError('');
              }}
              onKeyDown={(e) => {
                if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
                  e.preventDefault();
                  const next =
                    e.key === 'Home'
                      ? tabs[0]
                      : e.key === 'End'
                        ? tabs[tabs.length - 1]
                        : tabs[
                            (tabs.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) %
                              tabs.length
                          ];
                  useUi.setState({ settingsTab: next });
                  setRecording(null);
                  requestAnimationFrame(() => document.getElementById(`tab-${next}`)?.focus());
                }
              }}
            >
              {id === 'appearance' ? (
                <PaletteIcon size={17} />
              ) : id === 'hotkeys' ? (
                <Keyboard size={17} />
              ) : (
                <Download size={17} />
              )}{' '}
              {id === 'appearance' ? 'Appearance' : id === 'hotkeys' ? 'Hotkeys' : 'Updates'}
            </button>
          ))}
        </div>
        {saveError && (
          <p className="field-error" role="alert">
            {saveError}
          </p>
        )}
        {tab === 'appearance' ? (
          <div id="panel-appearance" role="tabpanel" aria-labelledby="tab-appearance">
            <p className="settings-intro">
              Choose any colours. Changes preview immediately and save automatically. Text and
              borders adjust for readability.
            </p>
            <div className="colour-grid">
              <ColourPicker
                label="Main colour"
                description="Task list and primary surfaces"
                value={palette.main}
                onChange={(main) =>
                  usePreferences.getState().update({ colours: { ...palette, main } })
                }
              />
              <ColourPicker
                label="Side colour"
                description="Sidebar and task details"
                value={palette.side}
                onChange={(side) =>
                  usePreferences.getState().update({ colours: { ...palette, side } })
                }
              />
              <ColourPicker
                label="Complement colour"
                description="Highlights, buttons, and accents"
                value={palette.complement}
                onChange={(complement) =>
                  usePreferences.getState().update({ colours: { ...palette, complement } })
                }
              />
            </div>
            <div className="settings-footer">
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={collapsed}
                  onChange={(e) =>
                    usePreferences.getState().update({ sidebarCollapsed: e.target.checked })
                  }
                />
                Collapse sidebar
              </label>
              <button
                type="button"
                onClick={() => usePreferences.getState().update({ colours: null })}
              >
                Reset colours to system theme
              </button>
            </div>
          </div>
        ) : tab === 'updates' ? (
          <UpdatesPanel />
        ) : (
          <div id="panel-hotkeys" role="tabpanel" aria-labelledby="tab-hotkeys">
            <p className="settings-intro">
              Click a shortcut, then press your preferred key or combination. Clear it to leave the
              action unassigned. Single-key shortcuts stay inactive while typing. Tab, text-editing
              shortcuts, and Escape in dialogs keep their usual behavior.
            </p>
            <div className="shortcut-toolbar">
              <input
                type="search"
                aria-label="Find a hotkey"
                placeholder="Find an action or shortcut…"
                autoComplete="off"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
              <button
                type="button"
                onClick={() => {
                  usePreferences.getState().resetHotkeys();
                  setRecording(null);
                  setError('');
                }}
              >
                Reset hotkeys
              </button>
            </div>
            <p
              role={error ? 'alert' : 'status'}
              className={error ? 'field-error shortcut-status' : 'muted shortcut-status'}
            >
              {error ||
                (recording
                  ? 'Press a key combination. Escape cancels; Tab leaves recording.'
                  : 'Changes save automatically. Duplicate assignments are rejected.')}
            </p>
            <div className="shortcut-list">
              {['App', 'Navigation', 'Tasks', 'Lists', 'Images'].map((group) => {
                const rows = visible.filter((c) => c.group === group);
                if (!rows.length) return null;
                return (
                  <section key={group} aria-label={`${group} hotkeys`}>
                    <h3>{group}</h3>
                    {rows.map((command) => (
                      <div className="shortcut-row" key={command.id}>
                        <span>{command.label}</span>
                        <button
                          type="button"
                          className={`shortcut-binding ${recording === command.id ? 'recording' : ''}`}
                          aria-label={`Shortcut for ${command.label}`}
                          aria-pressed={recording === command.id}
                          onClick={() => {
                            setRecording(command.id);
                            setError('');
                          }}
                          onBlur={() => {
                            if (recording === command.id) setRecording(null);
                          }}
                          onKeyDown={(e) => {
                            if (recording !== command.id) return;
                            if (e.key === 'Tab') {
                              setRecording(null);
                              return;
                            }
                            e.preventDefault();
                            e.stopPropagation();
                            if (e.key === 'Escape') {
                              setRecording(null);
                              setError('');
                              return;
                            }
                            if (e.nativeEvent.isComposing || e.repeat) return;
                            const binding = keyBinding(e);
                            if (!binding) return;
                            const result = usePreferences.getState().assign(command.id, binding);
                            setError(result ?? '');
                            if (!result) setRecording(null);
                          }}
                        >
                          {recording === command.id ? 'Press keys…' : keyLabel(hotkeys[command.id])}
                        </button>
                        <button
                          type="button"
                          className="text-button"
                          aria-label={`Clear shortcut for ${command.label}`}
                          disabled={!hotkeys[command.id]}
                          onClick={() => {
                            usePreferences.getState().assign(command.id, null);
                            setRecording(null);
                            setError('');
                          }}
                        >
                          Clear
                        </button>
                      </div>
                    ))}
                  </section>
                );
              })}
              {!visible.length && <p className="empty-state">No matching actions.</p>}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
