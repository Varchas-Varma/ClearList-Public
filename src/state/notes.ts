import { createStore } from 'zustand/vanilla';
type Draft = { text: string; version: number; status: 'pending' | 'saving' | 'error' };
export function createNotes(save: (id: string, text: string) => Promise<boolean>, delay = 450) {
  const store = createStore<{ drafts: Record<string, Draft> }>(() => ({ drafts: {} })),
    timers = new Map<string, ReturnType<typeof setTimeout>>(),
    inflight = new Map<string, Promise<boolean>>();
  let revision = 0;
  function remove(id: string) {
    const drafts = { ...store.getState().drafts };
    delete drafts[id];
    store.setState({ drafts });
  }
  async function flush(id: string): Promise<boolean> {
    clearTimeout(timers.get(id));
    timers.delete(id);
    const previous = inflight.get(id);
    if (previous) {
      if (!(await previous)) return false;
      return flush(id);
    }
    const draft = store.getState().drafts[id];
    if (!draft) return true;
    store.setState({
      drafts: { ...store.getState().drafts, [id]: { ...draft, status: 'saving' } },
    });
    const promise = save(id, draft.text).catch(() => false);
    inflight.set(id, promise);
    const success = await promise;
    inflight.delete(id);
    if (store.getState().drafts[id]?.version === draft.version) {
      if (success) remove(id);
      else
        store.setState({
          drafts: { ...store.getState().drafts, [id]: { ...draft, status: 'error' } },
        });
    }
    return success;
  }
  return {
    store,
    edit(id: string, text: string) {
      store.setState({
        drafts: {
          ...store.getState().drafts,
          [id]: { text, version: ++revision, status: 'pending' },
        },
      });
      clearTimeout(timers.get(id));
      timers.set(
        id,
        setTimeout(() => {
          void flush(id);
        }, delay),
      );
    },
    flush,
    async flushAll() {
      while (Object.keys(store.getState().drafts).length) {
        const outcomes = await Promise.all(Object.keys(store.getState().drafts).map(flush));
        if (outcomes.some((ok) => !ok)) return false;
      }
      return true;
    },
    discard(id: string) {
      clearTimeout(timers.get(id));
      timers.delete(id);
      remove(id);
    },
  };
}
