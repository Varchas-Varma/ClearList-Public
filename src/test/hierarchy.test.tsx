import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { repository } from '../services/repository';
import { optimistic } from '../state/reducer';
import { appStore, notes } from '../state/app';
import { useUi } from '../state/ui';
import { fixture } from './fixtures';
import App from '../App';
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
  Object.keys(notes.store.getState().drafts).forEach(notes.discard);
  useUi.setState({ deleteTaskId: null, moveTaskId: null });
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
describe('0.1.1 keyboard hierarchy', () => {
  it('browses from a draft, nests into an empty task, and promotes at a chosen gap', async () => {
    const user = await start();
    await addTask(user, 'First');
    await addTask(user, 'Second');
    await addTask(user, 'Third');
    const draft = screen.getByRole('textbox', { name: 'Add a task' });
    await user.type(draft, 'Keep my draft');
    expect(draft).toHaveAttribute('autocomplete', 'off');
    await key('ArrowUp');
    expect(row('Third')).toHaveFocus();
    expect(draft).toHaveValue('Keep my draft');
    await key('Enter');
    expect(useTreeUi.getState().movingId).toBe(row('Third').dataset.taskId);
    await key('ArrowUp');
    expect(row('Second')).toHaveFocus();
    await key('ArrowRight');
    expect(document.activeElement).toHaveAttribute('aria-label', 'Insert subtask here');
    await key('Enter');
    await waitFor(() =>
      expect(appStore.getState().data.tasks.find((t) => t.title === 'Third')?.parentId).toBe(
        row('Second').dataset.taskId,
      ),
    );
    expect(row('Third').closest('.subtask-list')).not.toBeNull();
    await waitFor(() => expect(row('Third')).toHaveFocus());
    await key('Enter');
    await key('ArrowLeft');
    expect(row('Second')).toHaveFocus();
    await key('ArrowUp');
    expect(document.activeElement).toHaveAttribute('aria-label', 'Insert task here');
    await key('Enter');
    await waitFor(() =>
      expect(appStore.getState().data.tasks.find((t) => t.title === 'Third')?.parentId).toBeNull(),
    );
    expect(
      within(screen.getByRole('main'))
        .getAllByRole('button', { name: /^Task: / })
        .map((n) => n.textContent),
    ).toEqual(['First', 'Third', 'Second']);
    expect(draft).toHaveValue('Keep my draft');
  });
  it('cancels moves, renames, completes, and deletes with keyboard controls', async () => {
    const user = await start();
    await addTask(user, 'Alpha');
    await addTask(user, 'Beta');
    await key('ArrowUp');
    await key('Enter');
    await key('ArrowUp');
    await key('Escape');
    expect(appStore.getState().data.tasks.every((t) => !t.parentId)).toBe(true);
    expect(row('Beta')).toHaveFocus();
    await key('F2');
    const input = screen.getByRole('textbox', { name: 'Task: Beta' });
    await user.clear(input);
    await user.type(input, 'Renamed{Enter}');
    await waitFor(() => expect(row('Renamed')).toHaveFocus());
    await key(' ');
    await waitFor(() =>
      expect(appStore.getState().data.tasks.find((t) => t.title === 'Renamed')?.isCompleted).toBe(
        true,
      ),
    );
    await key('Delete');
    expect(screen.getByRole('dialog', { name: 'Delete task?' })).toBeInTheDocument();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(appStore.getState().data.tasks.map((t) => t.title)).toEqual(['Alpha']),
    );
  });
});
