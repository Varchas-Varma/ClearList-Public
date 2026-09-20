import { create } from 'zustand';
import type { Target } from '../tree';
export const useTreeUi = create<{
  movingId: string | null;
  draggingId: string | null;
  target: Target | null;
  editingId: string | null;
  collapsed: Record<string, boolean>;
  setMoving(id: string | null, target?: Target | null): void;
  setTarget(target: Target): void;
  setEditing(id: string | null): void;
  expand(id: string): void;
  toggle(id: string): void;
}>((set) => ({
  movingId: null,
  draggingId: null,
  target: null,
  editingId: null,
  collapsed: {},
  setMoving: (movingId, target = null) => set({ movingId, target }),
  setTarget: (target) => set({ target }),
  setEditing: (editingId) => set({ editingId }),
  expand: (id) => set((s) => ({ collapsed: { ...s.collapsed, [id]: false } })),
  toggle: (id) => set((s) => ({ collapsed: { ...s.collapsed, [id]: !s.collapsed[id] } })),
}));
export function focusTarget(target: Target) {
  requestAnimationFrame(() => {
    const key =
      target.kind === 'row'
        ? `task-${target.id}`
        : `gap-${target.parentId ?? 'root'}-${target.beforeId ?? 'end'}-${String(target.completed)}`;
    const node = document.getElementById(key);
    node?.focus({ preventScroll: true });
    node?.scrollIntoView?.({ block: 'nearest' });
  });
}
