import { create } from 'zustand';
import {
  commands,
  defaultHotkeys,
  isMacOS,
  shortcutError,
  type CommandId,
  type Hotkeys,
} from './shortcuts';
import { hexColour, type Palette } from './colours';
export const PREFERENCES_KEY = 'clearlist.preferences.v1';
export interface Preferences {
  colours: Palette | null;
  hotkeys: Hotkeys;
  sidebarCollapsed: boolean;
}
export const defaultPreferences = (): Preferences => ({
  colours: null,
  hotkeys: defaultHotkeys(),
  sidebarCollapsed: false,
});
export function readPreferences(raw: string | null): Preferences {
  const defaults = defaultPreferences();
  if (!raw) return defaults;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) return defaults;
    const colours = parsed.colours;
    if (
      colours &&
      ['main', 'side', 'complement'].every(
        (k) => typeof colours[k] === 'string' && hexColour(colours[k]),
      )
    )
      defaults.colours = {
        main: hexColour(colours.main)!,
        side: hexColour(colours.side)!,
        complement: hexColour(colours.complement)!,
      };
    defaults.sidebarCollapsed = parsed.sidebarCollapsed === true;
    if (parsed.hotkeys && typeof parsed.hotkeys === 'object') {
      const keys = { ...defaults.hotkeys };
      for (const c of commands)
        if (parsed.hotkeys[c.id] === null || typeof parsed.hotkeys[c.id] === 'string')
          keys[c.id] = parsed.hotkeys[c.id];
      // Give the new selection modifier its default without resetting unrelated custom bindings.
      if (parsed.hotkeys.selectionModifier === undefined) {
        for (const c of commands)
          if (
            ['ArrowUp', 'ArrowDown', 'Home', 'End'].some(
              (key) => keys[c.id] === `${keys.selectionModifier}+${key}`,
            )
          )
            keys[c.id] = null;
      }
      // Older releases saved Windows defaults on every platform. Only migrate unchanged
      // defaults, and leave custom/cleared bindings and conflicts under the user's control.
      if (isMacOS() && parsed.hotkeyDefaultsVersion !== 2) {
        const legacy = defaultHotkeys(false);
        for (const c of commands) {
          const next = defaults.hotkeys[c.id];
          if (
            legacy[c.id] !== null &&
            keys[c.id] === legacy[c.id] &&
            next &&
            !shortcutError(c.id, next, keys)
          )
            keys[c.id] = next;
        }
      }
      if (commands.every((c) => keys[c.id] === null || !shortcutError(c.id, keys[c.id]!, keys)))
        defaults.hotkeys = keys;
    }
  } catch {
    /* Malformed preferences do not affect task data. */
  }
  return defaults;
}
function load(): Preferences {
  try {
    return readPreferences(localStorage.getItem(PREFERENCES_KEY));
  } catch {
    return defaultPreferences();
  }
}
export const usePreferences = create<
  Preferences & {
    saveError: string | null;
    update(patch: Partial<Preferences>): void;
    assign(id: CommandId, key: string | null): string | null;
    resetHotkeys(): void;
    toggleSidebar(): void;
  }
>((set, get) => ({
  ...load(),
  saveError: null,
  update: (patch) => {
    const old = get(),
      next = {
        colours: old.colours,
        hotkeys: old.hotkeys,
        sidebarCollapsed: old.sidebarCollapsed,
        ...patch,
      };
    let saveError = null;
    try {
      localStorage.setItem(
        PREFERENCES_KEY,
        JSON.stringify({ version: 1, hotkeyDefaultsVersion: 2, ...next }),
      );
    } catch {
      saveError =
        'Settings apply for this session, but could not be saved. Check available storage.';
    }
    set({ ...next, saveError });
  },
  assign: (id, key) => {
    const error = key && shortcutError(id, key, get().hotkeys);
    if (error) return error;
    get().update({ hotkeys: { ...get().hotkeys, [id]: key } });
    return null;
  },
  resetHotkeys: () => get().update({ hotkeys: defaultHotkeys() }),
  toggleSidebar: () => get().update({ sidebarCollapsed: !get().sidebarCollapsed }),
}));
