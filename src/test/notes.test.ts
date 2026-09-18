import { afterEach, describe, expect, it, vi } from 'vitest';
import { createNotes } from '../state/notes';
afterEach(() => vi.useRealTimers());
describe('notes autosave', () => {
  it('debounces and preserves line breaks', async () => {
    vi.useFakeTimers();
    const save = vi.fn(async () => true),
      notes = createNotes(save);
    notes.edit('a', 'first');
    notes.edit('a', 'first\nsecond');
    await vi.advanceTimersByTimeAsync(449);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledExactlyOnceWith('a', 'first\nsecond');
    expect(notes.store.getState().drafts).toEqual({});
  });
  it('flushes drafts before unmount/shutdown without waiting for debounce', async () => {
    const save = vi.fn(async () => true),
      notes = createNotes(save);
    notes.edit('a', 'A');
    notes.edit('b', 'B');
    expect(await notes.flushAll()).toBe(true);
    expect(save).toHaveBeenCalledTimes(2);
  });
  it('retains failed drafts for retry and blocks successful shutdown result', async () => {
    const save = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true),
      notes = createNotes(save);
    notes.edit('a', 'unsaved');
    expect(await notes.flushAll()).toBe(false);
    expect(notes.store.getState().drafts.a).toMatchObject({ text: 'unsaved', status: 'error' });
    expect(await notes.flushAll()).toBe(true);
    expect(notes.store.getState().drafts).toEqual({});
  });
  it('does not erase newer typing when an earlier save completes', async () => {
    let resolve!: (ok: boolean) => void;
    const save = vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise<boolean>((r) => {
              resolve = r;
            }),
        )
        .mockResolvedValue(true),
      notes = createNotes(save);
    notes.edit('a', 'old');
    const pending = notes.flush('a');
    notes.edit('a', 'new');
    resolve(true);
    await pending;
    expect(notes.store.getState().drafts.a.text).toBe('new');
    await notes.flushAll();
    expect(save).toHaveBeenLastCalledWith('a', 'new');
  });
});
