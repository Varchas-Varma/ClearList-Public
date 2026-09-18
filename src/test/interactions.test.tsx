import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { repository } from '../services/repository';
import { optimistic } from '../state/reducer';
import { appStore, notes } from '../state/app';
import { useUi } from '../state/ui';
import { fixture } from './fixtures';
import App from '../App';
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
describe('editing and navigation', () => {
  it('creates, renames, completes and deletes a task through the interface', async () => {
    const user = await start();
    await user.click(await addTask(user, 'Wire the display'));
    await user.click(screen.getByRole('button', { name: 'Task title' }));
    const input = screen.getByRole('textbox', { name: 'Task title' });
    await user.clear(input);
    await user.type(input, 'Test the display{Enter}');
    await screen.findByRole('button', { name: 'Task: Test the display, selected' });
    await user.click(screen.getByRole('checkbox', { name: 'Complete Test the display' }));
    expect(await screen.findByRole('region', { name: 'Completed tasks' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete selected task' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Delete task?' })).getByRole('button', {
        name: 'Delete',
      }),
    );
    await waitFor(() => expect(screen.queryByLabelText('Task details')).not.toBeInTheDocument());
    expect(
      screen.queryByRole('button', { name: /Task: Test the display/ }),
    ).not.toBeInTheDocument();
  });
  it('creates and deletes a list and moves a selected task without closing details', async () => {
    const user = await start();
    await addTask(user, 'Bring meter');
    await user.click(screen.getByRole('button', { name: 'New list' }));
    await user.type(screen.getByRole('textbox', { name: 'List name' }), 'Lab{Enter}');
    await screen.findByRole('button', { name: 'List: Lab' });
    await user.click(screen.getByRole('button', { name: 'Tasks' }));
    await user.click(screen.getByRole('button', { name: 'Task: Bring meter' }));
    await user.click(screen.getByRole('button', { name: 'Move to list' }));
    const select = screen.getByRole('combobox'),
      destination = within(select).getByRole('option', { name: 'Lab' }) as HTMLOptionElement;
    await user.selectOptions(select, destination.value);
    await user.click(screen.getByRole('button', { name: 'Move' }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Lab' })).toBeInTheDocument(),
    );
    expect(screen.getByLabelText('Task details')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Actions for list Lab' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete list…' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'List: Lab' })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('heading', { name: 'Tasks', level: 1 })).toBeInTheDocument();
  });
  it('reorders tasks and steps with accessible menu controls', async () => {
    const user = await start();
    await addTask(user, 'First');
    await addTask(user, 'Second');
    await user.click(screen.getByRole('button', { name: 'Actions for task Second' }));
    await user.click(screen.getByRole('menuitem', { name: 'Move up' }));
    expect(
      within(screen.getByRole('main')).getAllByRole('button', { name: /^Task: / })[0],
    ).toHaveAccessibleName('Task: Second');
    await user.click(screen.getByRole('button', { name: 'Task: Second' }));
    await user.type(screen.getByRole('textbox', { name: 'Add a step' }), 'Check supply{Enter}');
    await user.type(screen.getByRole('textbox', { name: 'Add a step' }), 'Check ground{Enter}');
    await user.click(screen.getByRole('button', { name: 'Actions for step Check ground' }));
    await user.click(screen.getByRole('menuitem', { name: 'Move up' }));
    expect(screen.getAllByRole('button', { name: /^Step: / })[0]).toHaveAccessibleName(
      'Step: Check ground',
    );
  });
  it('cancels inline changes, rejects empty titles, searches notes and preserves text Delete', async () => {
    const user = await start();
    await user.click(await addTask(user, 'Original'));
    await user.click(screen.getByRole('button', { name: 'Task title' }));
    await user.clear(screen.getByRole('textbox', { name: 'Task title' }));
    await user.keyboard('{Enter}');
    expect(screen.getByText('Enter a title between 1 and 500 characters.')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Task title' })).toHaveTextContent('Original');
    await user.type(screen.getByRole('textbox', { name: 'Task notes' }), 'Embedded firmware');
    await user.keyboard('{Delete}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.tab();
    await waitFor(() => expect(notes.store.getState().drafts).toEqual({}));
    await user.keyboard('{Control>}f{/Control}');
    expect(screen.getByRole('searchbox')).toHaveFocus();
    await user.type(screen.getByRole('searchbox'), 'FIRMWARE');
    expect(
      await screen.findByRole('button', { name: 'Task: Original, selected' }),
    ).toBeInTheDocument();
  });
  it('preserves text paste and extracts pasted images for the selected task', async () => {
    const user = await start();
    await user.click(await addTask(user, 'Picture'));
    const text = screen.getByRole('textbox', { name: 'Task notes' });
    await user.click(text);
    await user.paste('normal text');
    expect(text).toHaveValue('normal text');
    vi.mocked(repository.attach).mockImplementation(async () => appStore.getState().data);
    const file = new File(['image'], 'shot.png', { type: 'image/png' });
    fireEvent.paste(text, {
      clipboardData: {
        items: [{ kind: 'file', type: 'image/png', getAsFile: () => file }],
        files: [file],
      },
    });
    await waitFor(() => expect(repository.attach).toHaveBeenCalledTimes(1));
    expect(text).toHaveValue('normal text');
  });
  it('flushes final notes before permitting a native window close', async () => {
    const user = await start();
    await user.click(await addTask(user, 'Close test'));
    fireEvent.change(screen.getByRole('textbox', { name: 'Task notes' }), {
      target: { value: 'Last words\nPreserved' },
    });
    const event = { preventDefault: vi.fn() };
    await native.close!(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(repository.mutate).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: 'updateTask', notes: 'Last words\nPreserved' }),
    );
    expect(native.destroy).toHaveBeenCalledTimes(1);
  });
  it('keeps the native window open when the final note save fails', async () => {
    const user = await start();
    await user.click(await addTask(user, 'Failure'));
    vi.mocked(repository.mutate).mockRejectedValueOnce(new Error('Disk full'));
    fireEvent.change(screen.getByRole('textbox', { name: 'Task notes' }), {
      target: { value: 'Keep this draft' },
    });
    await native.close!({ preventDefault: vi.fn() });
    expect(native.destroy).not.toHaveBeenCalled();
    expect(Object.values(notes.store.getState().drafts)[0].text).toBe('Keep this draft');
  });
});
