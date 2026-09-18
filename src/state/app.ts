import { useStore } from 'zustand';
import { repository } from '../services/repository';
import { createAppStore, type AppState } from './store';
import { createNotes } from './notes';
export const appStore = createAppStore(repository);
export const notes = createNotes(async (id, text) =>
  appStore.getState().mutate({ kind: 'updateTask', id, notes: text }),
);
export const useApp = <T>(selector: (state: AppState) => T) => useStore(appStore, selector);
