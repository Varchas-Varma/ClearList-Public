import { create } from 'zustand';
export const useUi = create<{
  deleteTaskId: string | null;
  moveTaskId: string | null;
  requestDelete(id: string | null): void;
  requestMove(id: string | null): void;
}>((set) => ({
  deleteTaskId: null,
  moveTaskId: null,
  requestDelete: (deleteTaskId) => set({ deleteTaskId }),
  requestMove: (moveTaskId) => set({ moveTaskId }),
}));
