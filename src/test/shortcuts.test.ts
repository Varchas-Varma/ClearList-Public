import { describe, expect, it, vi } from 'vitest';
import {
  commands,
  commandFor,
  defaultHotkeys,
  keyLabel,
  shortcutError,
} from '../settings/shortcuts';
import { readPreferences } from '../settings/preferences';

describe('platform hotkeys', () => {
  it('keeps Windows defaults and provides non-conflicting Mac keyboard defaults', () => {
    const windows = defaultHotkeys(false),
      mac = defaultHotkeys(true);
    expect(windows.newTask).toBe('Ctrl+N');
    expect(windows.selectionModifier).toBe('Ctrl');
    expect(windows.newSubtask).toBe('Insert');
    expect(mac).toMatchObject({
      newTask: 'Meta+N',
      search: 'Meta+F',
      newList: 'Meta+Shift+N',
      selectionModifier: 'Meta',
      renameTask: 'Meta+R',
      deleteTask: 'Meta+Backspace',
      newSubtask: 'Meta+Shift+Enter',
      details: 'Meta+Enter',
      settings: 'Meta+,',
    });
    for (const command of commands) {
      const key = mac[command.id];
      if (key) expect(shortcutError(command.id, key, mac, true)).toBeNull();
    }
    expect(
      commandFor(
        { key: 'Backspace', metaKey: true, ctrlKey: false, altKey: false, shiftKey: false },
        mac,
      ),
    ).toBe('deleteTask');
    expect(keyLabel(mac.deleteTask, true)).toBe('Cmd+Delete');
    expect(keyLabel(mac.firstItem, true)).toBe('Option+↑');
  });
  it('allows Command reassignment but protects text editing and operating-system shortcuts', () => {
    const mac = defaultHotkeys(true);
    expect(shortcutError('newTask', 'Meta+K', mac, true)).toBeNull();
    expect(shortcutError('newTask', 'Meta+V', mac, true)).toMatch(/text editing/);
    expect(shortcutError('newTask', 'Meta+Q', mac, true)).toMatch(/operating system/);
    expect(shortcutError('newTask', 'Meta+K', defaultHotkeys(false), false)).toMatch(
      /operating system/,
    );
    expect(shortcutError('newTask', 'Meta+ArrowUp', mac, true)).toMatch(/task selection/);
  });
  it('migrates untouched defaults without replacing custom shortcuts, cleared actions, or conflicts', () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    const keys = {
      ...defaultHotkeys(false),
      newTask: 'Ctrl+K',
      newList: null,
      settings: 'Alt+ArrowUp',
    };
    const prefs = readPreferences(
      JSON.stringify({
        version: 1,
        hotkeys: keys,
        sidebarCollapsed: true,
        colours: { main: '#112233', side: '#445566', complement: '#abcdef' },
      }),
    );
    expect(prefs.hotkeys).toMatchObject({
      newTask: 'Ctrl+K',
      search: 'Meta+F',
      newList: null,
      selectionModifier: 'Meta',
      renameTask: 'Meta+R',
      settings: 'Alt+ArrowUp',
      firstItem: 'Home',
    });
    expect(prefs.sidebarCollapsed).toBe(true);
    expect(prefs.colours?.main).toBe('#112233');
  });
  it('does not re-migrate intentional Ctrl bindings saved after the upgrade', () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    const hotkeys = { ...defaultHotkeys(true), newTask: 'Ctrl+N', selectionModifier: 'Ctrl' };
    expect(
      readPreferences(JSON.stringify({ version: 1, hotkeyDefaultsVersion: 2, hotkeys })).hotkeys,
    ).toEqual(hotkeys);
  });
});
