import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { repository } from '../services/repository';
import { optimistic } from '../state/reducer';
import { appStore, notes } from '../state/app';
import { useUi } from '../state/ui';
import { fixture } from './fixtures';
import App from '../App';
import {
  defaultPreferences,
  PREFERENCES_KEY,
  readPreferences,
  usePreferences,
} from '../settings/preferences';
import { contrast, foreground, fromHSV, toHSV } from '../settings/colours';
import { useTreeUi } from '../state/treeUi';
const native = vi.hoisted(() => ({
  close: null as null | ((event: { preventDefault(): void }) => Promise<void>),
  destroy: vi.fn(),
}));
vi.mock('../services/repository', () => ({
  repository: { load: vi.fn(), mutate: vi.fn(), attach: vi.fn(), readImage: vi.fn() },
}));
vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => true }));
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    onCloseRequested: async (callback: typeof native.close) => {
      native.close = callback;
      return () => {};
    },
    destroy: native.destroy,
  }),
}));
beforeEach(async () => {
  await appStore.getState().drain();
  vi.clearAllMocks();
  localStorage.clear();
  usePreferences.setState({ ...defaultPreferences(), saveError: null });
  Object.keys(notes.store.getState().drafts).forEach(notes.discard);
  useUi.setState({
    deleteTaskId: null,
    moveTaskId: null,
    settingsOpen: false,
    settingsTab: 'appearance',
    editingListId: null,
    deletingListId: null,
  });
  useTreeUi.setState({
    movingId: null,
    draggingId: null,
    target: null,
    editingId: null,
    collapsed: {},
  });
  let data = fixture();
  vi.mocked(repository.load).mockImplementation(async () => structuredClone(data));
  vi.mocked(repository.mutate).mockImplementation(async (change) => {
    data = optimistic(data, change);
    return structuredClone(data);
  });
  appStore.setState({
    loaded: false,
    search: '',
    selectedListId: null,
    selectedTaskId: null,
    error: null,
  });
});
async function start() {
  render(<App />);
  await screen.findByRole('textbox', { name: 'Add a task' });
  return userEvent.setup();
}
async function addTask(user: ReturnType<typeof userEvent.setup>, title: string) {
  await user.type(screen.getByRole('textbox', { name: 'Add a task' }), `${title}{Enter}`);
  return screen.findByRole('button', { name: `Task: ${title}` });
}

function row(title: string) {
  return screen
    .getByRole('button', { name: new RegExp(`^Task: ${title}(, selected)?$`) })
    .closest<HTMLElement>('[data-task-id]')!;
}
async function key(value: string) {
  fireEvent.keyDown(document.activeElement!, { key: value });
  await new Promise((r) => setTimeout(r, 30));
}

async function settings(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Settings' }));
  await user.click(screen.getByRole('tab', { name: 'Hotkeys' }));
}
describe('0.1.2 settings', () => {
  it('records keys after a click without browser focus and always allows cancellation', async () => {
    const user = await start();
    await settings(user);
    const search = screen.getByRole('searchbox', { name: 'Find a hotkey' });
    const binding = screen.getByRole('button', { name: 'Shortcut for Jump to Add a task' });
    search.focus();
    // Safari/WKWebView does not focus clicked buttons. Exercise the fallback even
    // when the explicit focus request cannot take effect.
    const focus = vi.spyOn(binding, 'focus').mockImplementation(() => {});
    fireEvent.click(binding);
    expect(search).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'k', ctrlKey: true });
    expect(binding).toHaveTextContent('Ctrl+K');
    expect(binding).toHaveAttribute('aria-pressed', 'false');
    expect(search).toHaveValue('');
    focus.mockRestore();
    fireEvent.click(binding);
    expect(binding).toHaveFocus();
    fireEvent.keyDown(binding, { key: 'Control', ctrlKey: true });
    expect(binding).toHaveTextContent('Press keys');
    fireEvent.keyDown(binding, { key: 'Escape' });
    expect(binding).toHaveTextContent('Ctrl+K');
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
    fireEvent.click(binding);
    await user.tab();
    expect(binding).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(binding);
    fireEvent(window, new Event('blur'));
    expect(binding).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(binding);
    await user.click(screen.getByRole('button', { name: 'Cancel recording' }));
    expect(binding).toHaveAttribute('aria-pressed', 'false');
  });
  it('records Command shortcuts on Mac, persists them, and uses Command for task selection', async () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    usePreferences.setState(defaultPreferences());
    const user = await start();
    await addTask(user, 'One');
    await addTask(user, 'Two');
    await settings(user);
    const binding = screen.getByRole('button', { name: 'Shortcut for Jump to Add a task' });
    expect(binding).toHaveTextContent('Cmd+N');
    fireEvent.click(binding);
    fireEvent.keyDown(binding, { key: 'Meta', metaKey: true });
    fireEvent.keyDown(binding, { key: 'k', metaKey: true });
    expect(binding).toHaveTextContent('Cmd+K');
    expect(binding).toHaveAttribute('aria-pressed', 'false');
    expect(readPreferences(localStorage.getItem(PREFERENCES_KEY)).hotkeys.newTask).toBe('Meta+K');
    const modifier = screen.getByRole('button', {
      name: 'Shortcut for Hold to extend task selection',
    });
    expect(modifier).toHaveTextContent('Cmd');
    fireEvent.click(modifier);
    fireEvent.keyDown(modifier, { key: 'Meta', metaKey: true });
    expect(modifier).toHaveAttribute('aria-pressed', 'false');
    await user.click(screen.getByRole('button', { name: 'Close dialog' }));
    row('One').focus();
    fireEvent.keyDown(document.activeElement!, { key: 'k', metaKey: true });
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Add a task' })).toHaveFocus());
    row('One').focus();
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown', metaKey: true });
    expect(appStore.getState().selectedTaskIds).toHaveLength(2);
  });
  it('reassigns an existing hotkey and persists it without retaining the old binding', async () => {
    const user = await start();
    await addTask(user, 'One');
    await settings(user);
    const binding = screen.getByRole('button', { name: 'Shortcut for Jump to Add a task' });
    await user.click(binding);
    fireEvent.keyDown(binding, { key: 'k', ctrlKey: true });
    expect(binding).toHaveTextContent('Ctrl+K');
    await user.click(screen.getByRole('button', { name: 'Close dialog' }));
    row('One').focus();
    await key('Home');
    fireEvent.keyDown(document.activeElement!, { key: 'n', ctrlKey: true });
    expect(screen.getByRole('textbox', { name: 'Add a task' })).not.toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'k', ctrlKey: true });
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Add a task' })).toHaveFocus());
    expect(readPreferences(localStorage.getItem(PREFERENCES_KEY)).hotkeys.newTask).toBe('Ctrl+K');
  });
  it('rejects duplicate bindings, assigns an unassigned action, and leaves typed text alone', async () => {
    const user = await start();
    await addTask(user, 'One');
    await settings(user);
    const search = screen.getByRole('button', { name: 'Shortcut for Jump to task search' });
    await user.click(search);
    fireEvent.keyDown(search, { key: 'n', ctrlKey: true });
    expect(screen.getByRole('alert')).toHaveTextContent('Already assigned');
    expect(usePreferences.getState().hotkeys.search).toBe('Ctrl+F');
    const important = screen.getByRole('button', { name: 'Shortcut for Mark / unmark important' });
    expect(important).toHaveTextContent('Unassigned');
    await user.click(important);
    fireEvent.keyDown(important, { key: 'q' });
    await user.click(screen.getByRole('button', { name: 'Close dialog' }));
    row('One').focus();
    await key('q');
    expect(appStore.getState().data.tasks[0].isImportant).toBe(true);
    const entry = screen.getByRole('textbox', { name: 'Add a task' });
    await user.type(entry, 'qqq');
    expect(entry).toHaveValue('qqq');
    expect(appStore.getState().data.tasks[0].isImportant).toBe(true);
    await settings(user);
    await user.click(
      screen.getByRole('button', { name: 'Clear shortcut for Mark / unmark important' }),
    );
    expect(usePreferences.getState().hotkeys.importantTask).toBeNull();
  });
  it('persists all three colours, applies valid hex values, and rejects invalid ones', async () => {
    const user = await start();
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    for (const [label, value, variable] of [
      ['Main colour', '#123456', '--surface'],
      ['Side colour', '#fceedd', '--sidebar'],
      ['Complement colour', '#ab0', '--accent'],
    ]) {
      const input = screen.getByRole('textbox', { name: `${label} hex colour` });
      fireEvent.change(input, { target: { value } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(document.documentElement.style.getPropertyValue(variable)).toBe(
        value === '#ab0' ? '#aabb00' : value,
      );
    }
    expect(readPreferences(localStorage.getItem(PREFERENCES_KEY)).colours).toEqual({
      main: '#123456',
      side: '#fceedd',
      complement: '#aabb00',
    });
    const input = screen.getByRole('textbox', { name: 'Main colour hex colour' });
    fireEvent.change(input, { target: { value: '#oops' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByRole('alert')).toHaveTextContent('hexadecimal');
    expect(usePreferences.getState().colours?.main).toBe('#123456');
    fireEvent.change(screen.getByRole('slider', { name: 'Main colour brightness' }), {
      target: { value: 0 },
    });
    expect(usePreferences.getState().colours?.main).toBe('#000000');
    for (const colour of ['#000000', '#ffffff', '#f8eb22', '#123456', '#773355']) {
      expect(fromHSV(toHSV(colour))).toBe(colour);
      expect(contrast(foreground(colour), colour)).toBeGreaterThan(4.5);
    }
  });
  it('keeps settings accessible in the collapsed sidebar and expands for search or new-list hotkeys', async () => {
    const user = await start();
    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
    expect(readPreferences(localStorage.getItem(PREFERENCES_KEY)).sidebarCollapsed).toBe(true);
    expect(screen.getByRole('button', { name: 'Settings' })).toBeVisible();
    await user.keyboard('{Control>}f{/Control}');
    await waitFor(() =>
      expect(screen.getByRole('searchbox', { name: 'Search all tasks' })).toHaveFocus(),
    );
    expect(usePreferences.getState().sidebarCollapsed).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    await user.keyboard('{Control>}{Shift>}n{/Shift}{/Control}');
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'List name' })).toHaveFocus());
    expect(usePreferences.getState().sidebarCollapsed).toBe(false);
  });
});
