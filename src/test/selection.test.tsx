import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { repository } from '../services/repository';
import { optimistic } from '../state/reducer';
import { appStore, notes } from '../state/app';
import { useUi } from '../state/ui';
import { fixture } from './fixtures';
import { defaultPreferences, usePreferences } from '../settings/preferences';
import { useTreeUi } from '../state/treeUi';
import { purgeChanges } from '../state/selection';
import type { Snapshot } from '../domain';
import App from '../App';
vi.mock('../services/repository', () => ({
  repository: { load: vi.fn(), mutate: vi.fn(), attach: vi.fn(), readImage: vi.fn() },
}));
vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => true }));
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ onCloseRequested: async () => () => {}, destroy: vi.fn() }),
}));
let data: Snapshot;
beforeEach(async () => {
  await appStore.getState().drain();
  vi.clearAllMocks();
  URL.createObjectURL = vi.fn(() => 'blob:test-image');
  URL.revokeObjectURL = vi.fn();
  usePreferences.setState({ ...defaultPreferences(), saveError: null });
  Object.keys(notes.store.getState().drafts).forEach(notes.discard);
  useUi.setState({
    deleteTaskId: null,
    moveTaskId: null,
    deleteTaskIds: [],
    moveTaskIds: [],
    renameTaskIds: [],
    purge: null,
    settingsOpen: false,
  });
  useTreeUi.setState({
    movingId: null,
    draggingId: null,
    target: null,
    hoveredId: null,
    editingId: null,
    collapsed: {},
    completedOpen: true,
  });
  data = fixture();
  for (const title of ['Alpha', 'Beta', 'Gamma'])
    data = optimistic(data, { kind: 'createTask', id: title, listId: 'default', title });
  vi.mocked(repository.load).mockImplementation(async () => structuredClone(data));
  vi.mocked(repository.mutate).mockImplementation(async (change) => {
    data = optimistic(data, change);
    return structuredClone(data);
  });
  vi.mocked(repository.readImage).mockResolvedValue(new ArrayBuffer(1));
  appStore.setState({
    loaded: false,
    search: '',
    selectedListId: null,
    selectedTaskId: null,
    selectedTaskIds: [],
    selectionAnchorId: null,
    error: null,
  });
});
function row(title: string) {
  return document.querySelector<HTMLElement>(`[data-task-id="${title}"]`)!;
}
async function key(key: string, ctrlKey = false) {
  fireEvent.keyDown(document.activeElement!, { key, ctrlKey });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 25));
  });
}
async function start() {
  render(<App />);
  await screen.findByRole('textbox', { name: 'Add a task' });
  return userEvent.setup();
}
describe('0.1.4 task selection', () => {
  it('extends and shrinks a range, adds to each task, completes, nests, and deletes the whole selection', async () => {
    const user = await start();
    row('Alpha').focus();
    await key('ArrowDown', true);
    expect(appStore.getState().selectedTaskIds).toEqual(['Alpha', 'Beta']);
    await key('ArrowDown', true);
    expect(appStore.getState().selectedTaskIds).toEqual(['Alpha', 'Beta', 'Gamma']);
    await key('ArrowUp', true);
    expect(appStore.getState().selectedTaskIds).toEqual(['Alpha', 'Beta']);
    await key('Insert');
    await user.type(
      screen.getByRole('textbox', { name: 'Subtask for each selected task' }),
      'Shared step{Enter}',
    );
    await waitFor(() =>
      expect(data.tasks.filter((t) => t.title === 'Shared step').map((t) => t.parentId)).toEqual([
        'Alpha',
        'Beta',
      ]),
    );
    await user.click(screen.getByRole('button', { name: 'Complete all' }));
    await waitFor(() =>
      expect(data.tasks.filter((t) => t.isCompleted).map((t) => t.id)).toEqual(['Alpha', 'Beta']),
    );
    await user.click(screen.getByRole('button', { name: 'Uncomplete all' }));
    await waitFor(() => expect(data.tasks.every((t) => !t.isCompleted)).toBe(true));
    row('Alpha').focus();
    await key('Enter');
    await key('ArrowUp');
    expect(row('Gamma')).toHaveFocus();
    await key('ArrowRight');
    await key('Enter');
    await waitFor(() =>
      expect(
        data.tasks
          .filter((t) => ['Alpha', 'Beta'].includes(t.id))
          .every((t) => t.parentId === 'Gamma'),
      ).toBe(true),
    );
    expect(data.tasks.filter((t) => t.title === 'Shared step').map((t) => t.parentId)).toEqual([
      'Alpha',
      'Beta',
    ]);
    row('Beta').focus();
    await key('Delete');
    await user.click(
      within(screen.getByRole('dialog', { name: 'Delete 2 tasks?' })).getByRole('button', {
        name: 'Delete',
      }),
    );
    await waitFor(() => expect(data.tasks.map((t) => t.id)).toEqual(['Gamma']));
  });
  it('supports modifier click, protects typing, and shows ordered note and image summaries including descendants', async () => {
    data = optimistic(data, { kind: 'createStep', id: 'child', taskId: 'Alpha', title: 'Child' });
    data = optimistic(data, {
      kind: 'updateTask',
      id: 'child',
      notes: 'First line\nHidden second line',
    });
    data.attachments.push({
      id: 'image',
      taskId: 'child',
      fileName: 'Child image.png',
      storedPath: 'image.png',
      mimeType: 'image/png',
      fileSize: 1,
      createdAt: '',
    });
    const user = await start();
    await user.keyboard('{Control>}');
    await user.click(screen.getByRole('button', { name: 'Task: Alpha' }));
    await user.click(screen.getByRole('button', { name: 'Task: Gamma' }));
    await user.keyboard('{/Control}');
    expect(appStore.getState().selectedTaskIds).toEqual(['Alpha', 'Gamma']);
    const area = screen.getByRole('region', { name: 'Selected tasks and subtasks scroll area' });
    expect(
      within(area)
        .getAllByRole('article')
        .map((n) => n.getAttribute('aria-label')),
    ).toEqual(['Summary for Alpha', 'Summary for Child', 'Summary for Gamma']);
    expect(within(area).getByText('First line')).toBeInTheDocument();
    expect(within(area).queryByText('Hidden second line')).toBeNull();
    expect(
      within(area).getByRole('button', { name: 'Preview Child image.png' }),
    ).toBeInTheDocument();
    const input = screen.getByRole('textbox', { name: 'Add a task' });
    await user.type(input, 'Draft');
    await key('ArrowUp', true);
    expect(input).toHaveFocus();
    expect(input).toHaveValue('Draft');
    expect(appStore.getState().selectedTaskIds).toEqual(['Alpha', 'Gamma']);
  });
  it('keeps new commands unassigned and reassigns the selection modifier and completed-section shortcut', async () => {
    data = optimistic(data, { kind: 'completeTask', id: 'Gamma', completed: true });
    const user = await start();
    expect(usePreferences.getState().hotkeys.selectionModifier).toBe('Ctrl');
    expect(usePreferences.getState().hotkeys.purgeCompleted).toBeNull();
    expect(usePreferences.getState().hotkeys.purgeIncomplete).toBeNull();
    expect(usePreferences.getState().hotkeys.toggleCompleted).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('tab', { name: 'Hotkeys' }));
    await user.click(
      screen.getByRole('button', { name: 'Shortcut for Hold to extend task selection' }),
    );
    fireEvent.keyDown(document.activeElement!, { key: 'Shift', shiftKey: true });
    expect(usePreferences.getState().hotkeys.selectionModifier).toBe('Shift');
    await user.click(
      screen.getByRole('button', { name: 'Shortcut for Collapse / expand completed tasks' }),
    );
    fireEvent.keyDown(document.activeElement!, { key: 'F8' });
    await user.click(screen.getByRole('button', { name: 'Close dialog' }));
    row('Alpha').focus();
    await key('F8');
    expect(screen.getByRole('button', { name: 'Completed 1' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});
describe.each([true, false])('purge status %s', (completed) => {
  it('keeps opposite-status descendants, attachments, ordering, and other lists', async () => {
    data = optimistic(data, { kind: 'completeTask', id: 'Alpha', completed });
    data = optimistic(data, { kind: 'completeTask', id: 'Beta', completed: !completed });
    data = optimistic(data, { kind: 'completeTask', id: 'Gamma', completed: !completed });
    for (const [id, taskId, status] of [
      ['child', 'Alpha', !completed],
      ['grandchild', 'child', completed],
      ['leaf', 'grandchild', !completed],
    ] as const) {
      data = optimistic(data, { kind: 'createStep', id, taskId, title: id });
      data = optimistic(data, { kind: 'completeTask', id, completed: status });
    }
    data = optimistic(data, { kind: 'createList', id: 'other', name: 'Other' });
    data = optimistic(data, {
      kind: 'createTask',
      id: 'outside',
      listId: 'other',
      title: 'Outside',
    });
    data = optimistic(data, { kind: 'completeTask', id: 'outside', completed });
    data.attachments.push({
      id: 'image',
      taskId: 'leaf',
      fileName: 'Keep.png',
      storedPath: 'keep.png',
      mimeType: 'image/png',
      fileSize: 1,
      createdAt: '',
    });
    data = optimistic(data, { kind: 'updateTask', id: 'leaf', notes: 'Preserved' });
    const plan = purgeChanges(data.tasks, 'default', completed);
    expect(plan.length).toBeGreaterThan(0);
    const user = await start();
    await user.click(
      screen.getByRole('button', {
        name: completed ? 'Purge completed tasks' : 'Purge incomplete tasks',
      }),
    );
    expect(data.tasks.some((t) => t.id === 'Alpha')).toBe(true);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(
        data.tasks.filter((t) => t.listId === 'default' && t.isCompleted === completed),
      ).toHaveLength(0),
    );
    expect(data.tasks.find((t) => t.id === 'child')?.parentId).toBeNull();
    expect(data.tasks.find((t) => t.id === 'leaf')?.parentId).toBe('child');
    expect(data.tasks.find((t) => t.id === 'leaf')?.notes).toBe('Preserved');
    expect(data.attachments.map((a) => a.id)).toEqual(['image']);
    expect(data.tasks.some((t) => t.id === 'outside')).toBe(true);
    expect(
      data.tasks
        .filter((t) => t.listId === 'default' && !t.parentId)
        .sort((a, b) => a.position - b.position)
        .map((t) => t.id),
    ).toEqual(['Beta', 'Gamma', 'child']);
  });
});
