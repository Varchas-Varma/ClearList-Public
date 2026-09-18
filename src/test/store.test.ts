import { describe, expect, it, vi } from 'vitest';
import { createAppStore } from '../state/store';
import { optimistic } from '../state/reducer';
import type { Repository } from '../services/repository';
import { populated } from './fixtures';
import { taskOrder, type Mutation, type Snapshot } from '../domain';
function repository(): Repository {
  let data = populated();
  return {
    load: vi.fn(async () => structuredClone(data)),
    mutate: vi.fn(async (change: Mutation) => {
      data = optimistic(data, change);
      return structuredClone(data);
    }),
    attach: vi.fn(),
    readImage: vi.fn(),
  };
}
describe('write queue', () => {
  it('serializes rapid drops without stale results overwriting a newer optimistic order', async () => {
    const repo = repository();
    let resolve!: (data: Snapshot) => void;
    vi.mocked(repo.mutate).mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const store = createAppStore(repo);
    await store.getState().load();
    const first: Mutation = {
      kind: 'reorderTasks',
      listId: 'default',
      completed: false,
      ids: ['b', 'a', 'c'],
    };
    const a = store.getState().mutate(first),
      b = store.getState().mutate({
        kind: 'reorderTasks',
        listId: 'default',
        completed: false,
        ids: ['c', 'b', 'a'],
      });
    expect(repo.mutate).toHaveBeenCalledTimes(1);
    expect(taskOrder(store.getState().data.tasks, 'default', false).map((t) => t.id)).toEqual([
      'c',
      'b',
      'a',
    ]);
    resolve(optimistic(populated(), first));
    await Promise.all([a, b]);
    expect(repo.mutate).toHaveBeenCalledTimes(2);
    expect(taskOrder(store.getState().data.tasks, 'default', false).map((t) => t.id)).toEqual([
      'c',
      'b',
      'a',
    ]);
  });
  it('rolls back rejected writes and reports the failure', async () => {
    const repo = repository(),
      store = createAppStore(repo);
    await store.getState().load();
    vi.mocked(repo.mutate).mockRejectedValueOnce(new Error('Disk full'));
    expect(await store.getState().mutate({ kind: 'deleteTask', id: 'a' })).toBe(false);
    expect(store.getState().data.tasks.some((t) => t.id === 'a')).toBe(true);
    expect(store.getState().error).toBe('Disk full');
    expect(store.getState().writeFailures).toBe(1);
  });
  it('keeps selection when moving and selects default after deleting the selected list', async () => {
    const store = createAppStore(repository());
    await store.getState().load();
    await store.getState().mutate({ kind: 'createList', id: 'other', name: 'Next' });
    store.getState().selectTask('a');
    await store.getState().mutate({ kind: 'moveTask', id: 'a', listId: 'other' });
    expect(store.getState().selectedTaskId).toBe('a');
    expect(store.getState().selectedListId).toBe('other');
    await store.getState().mutate({ kind: 'deleteList', id: 'other' });
    expect(store.getState().selectedTaskId).toBeNull();
    expect(store.getState().selectedListId).toBe('default');
  });
});
