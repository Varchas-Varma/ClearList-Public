import { createStore } from 'zustand/vanilla';
import { emptySnapshot, type Mutation, type Snapshot } from '../domain';
import type { Repository } from '../services/repository';
import { optimistic } from './reducer';
export interface AppState {
  data: Snapshot;
  loaded: boolean;
  loading: boolean;
  pending: number;
  writeFailures: number;
  error: string | null;
  selectedListId: string | null;
  selectedTaskId: string | null;
  selectedTaskIds: string[];
  selectionAnchorId: string | null;
  search: string;
  load(): Promise<void>;
  mutate(change: Mutation): Promise<boolean>;
  attach(taskId: string, file: File): Promise<boolean>;
  drain(): Promise<void>;
  selectList(id: string): void;
  selectTask(id: string | null): void;
  selectTasks(ids: string[], anchorId?: string | null): void;
  setSearch(value: string): void;
  setError(value: string | null): void;
}
export function createAppStore(repo: Repository) {
  let committed = emptySnapshot(),
    running = false;
  let loadPromise: Promise<void> | undefined;
  type Job = {
    change?: Mutation;
    execute: () => Promise<Snapshot>;
    resolve: (value: boolean) => void;
  };
  const queue: Job[] = [],
    waiters: (() => void)[] = [];
  return createStore<AppState>((set, get) => {
    function project() {
      let data = committed;
      for (const job of queue) if (job.change) data = optimistic(data, job.change);
      const state = get(),
        selected = data.tasks.find((t) => t.id === state.selectedTaskId);
      const selectedTaskIds = state.selectedTaskIds.filter((id) =>
        data.tasks.some((t) => t.id === id),
      );
      set({
        data,
        selectedTaskId: selected?.id ?? selectedTaskIds[0] ?? null,
        selectedTaskIds,
        selectionAnchorId: data.tasks.some((t) => t.id === state.selectionAnchorId)
          ? state.selectionAnchorId
          : null,
        selectedListId:
          selected?.listId ??
          (data.lists.some((l) => l.id === state.selectedListId)
            ? state.selectedListId
            : (data.lists[0]?.id ?? null)),
        pending: queue.length,
      });
    }
    async function pump() {
      if (running) return;
      running = true;
      while (queue.length) {
        const job = queue[0];
        let success = true;
        try {
          committed = await job.execute();
        } catch (error) {
          success = false;
          set({
            error: error instanceof Error ? error.message : String(error),
            writeFailures: get().writeFailures + 1,
          });
          try {
            committed = await repo.load();
          } catch {
            /* Retain the last confirmed snapshot if a reconciliation read also fails. */
          }
        }
        queue.shift();
        project();
        job.resolve(success);
      }
      running = false;
      waiters.splice(0).forEach((r) => r());
    }
    function enqueue(execute: Job['execute'], change?: Mutation): Promise<boolean> {
      try {
        if (change) optimistic(get().data, change);
      } catch (error) {
        set({ error: String(error instanceof Error ? error.message : error) });
        return Promise.resolve(false);
      }
      return new Promise((resolve) => {
        queue.push({ execute, change, resolve });
        project();
        void pump();
      });
    }
    return {
      data: committed,
      loaded: false,
      loading: false,
      pending: 0,
      writeFailures: 0,
      error: null,
      selectedListId: null,
      selectedTaskId: null,
      selectedTaskIds: [],
      selectionAnchorId: null,
      search: '',
      load: () => {
        if (loadPromise) return loadPromise;
        set({ loading: true, error: null });
        loadPromise = (async () => {
          try {
            committed = await repo.load();
            set({ loaded: true });
            project();
          } catch (error) {
            set({ error: String(error instanceof Error ? error.message : error) });
          } finally {
            set({ loading: false });
            loadPromise = undefined;
          }
        })();
        return loadPromise;
      },
      mutate: (change) => enqueue(() => repo.mutate(change), change),
      attach: (id, file) => enqueue(() => repo.attach(id, file)),
      drain: () =>
        running || queue.length ? new Promise<void>((r) => waiters.push(r)) : Promise.resolve(),
      selectList: (id) =>
        set({
          selectedListId: id,
          selectedTaskId: null,
          selectedTaskIds: [],
          selectionAnchorId: null,
          search: '',
        }),
      selectTask: (id) =>
        set({
          selectedTaskId: id,
          selectedTaskIds: id ? [id] : [],
          selectionAnchorId: id,
          ...(id
            ? {
                selectedListId:
                  get().data.tasks.find((t) => t.id === id)?.listId ?? get().selectedListId,
              }
            : {}),
        }),
      selectTasks: (ids, anchorId) => {
        const selectedTaskIds = [...new Set(ids)].filter((id) =>
          get().data.tasks.some((t) => t.id === id),
        );
        const first = get().data.tasks.find((t) => t.id === selectedTaskIds[0]);
        set({
          selectedTaskIds,
          selectedTaskId: first?.id ?? null,
          selectionAnchorId: anchorId ?? selectedTaskIds[0] ?? null,
          ...(first ? { selectedListId: first.listId } : {}),
        });
      },
      setSearch: (search) =>
        set({ search, selectedTaskId: null, selectedTaskIds: [], selectionAnchorId: null }),
      setError: (error) => set({ error }),
    };
  });
}
