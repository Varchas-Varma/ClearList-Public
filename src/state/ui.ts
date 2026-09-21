import { create } from 'zustand';
export const useUi = create<{
  settingsOpen: boolean;
  settingsTab: 'appearance' | 'hotkeys' | 'updates';
  editingListId: string | null;
  deletingListId: string | null;
  openSettings(tab?: 'appearance' | 'hotkeys' | 'updates'): void;
  deleteTaskId: string | null;
  moveTaskId: string | null;
  requestDelete(id: string | null): void;
  requestMove(id: string | null): void;
}>((set) => ({
  settingsOpen: false,
  settingsTab: 'appearance',
  editingListId: null,
  deletingListId: null,
  openSettings: (settingsTab = 'appearance') => set({ settingsOpen: true, settingsTab }),
  deleteTaskId: null,
  moveTaskId: null,
  requestDelete: (deleteTaskId) => set({ deleteTaskId }),
  requestMove: (moveTaskId) => set({ moveTaskId }),
}));
