import { invoke } from '@tauri-apps/api/core';
import type { Mutation, Snapshot } from '../domain';
export interface Repository {
  load(): Promise<Snapshot>;
  mutate(change: Mutation): Promise<Snapshot>;
  attach(taskId: string, file: File): Promise<Snapshot>;
  readImage(id: string): Promise<ArrayBuffer>;
}
export const repository: Repository = {
  load: () => invoke<Snapshot>('snapshot'),
  mutate: (mutation) => invoke<Snapshot>('mutate', { mutation }),
  attach: async (taskId, file) =>
    invoke<Snapshot>('add_attachment', new Uint8Array(await file.arrayBuffer()), {
      headers: { 'x-task-id': taskId },
    }),
  readImage: (id) => invoke<ArrayBuffer>('read_attachment', { id }),
};
