import { create } from 'zustand';
import { selectionFor } from './selection';
export const useUi = create<{
  settingsOpen: boolean;
  settingsTab: 'appearance' | 'hotkeys' | 'updates';
  editingListId: string | null;
  deletingListId: string | null;
  openSettings(tab?: 'appearance' | 'hotkeys' | 'updates'): void;
  deleteTaskId: string | null;
  moveTaskId: string | null;
  deleteTaskIds: string[];
  moveTaskIds: string[];
  renameTaskIds: string[];
  purge: { listId: string; completed: boolean } | null;
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
  deleteTaskIds: [],
  moveTaskIds: [],
  renameTaskIds: [],
  purge: null,
  requestDelete: (deleteTaskId) =>
    set({ deleteTaskId, deleteTaskIds: deleteTaskId ? selectionFor(deleteTaskId) : [] }),
  requestMove: (moveTaskId) =>
    set({ moveTaskId, moveTaskIds: moveTaskId ? selectionFor(moveTaskId) : [] }),
}));
