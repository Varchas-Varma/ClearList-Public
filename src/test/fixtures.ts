import { emptySnapshot, type Snapshot } from '../domain';
import { optimistic } from '../state/reducer';
export function fixture(): Snapshot {
  const data = emptySnapshot();
  data.lists = [
    { id: 'default', name: 'Tasks', isDefault: true, position: 0, createdAt: '', updatedAt: '' },
  ];
  return data;
}
export function populated(): Snapshot {
  let data = fixture();
  for (const [id, title] of [
    ['a', 'Build circuit'],
    ['b', 'Read notes'],
    ['c', 'Test display'],
  ])
    data = optimistic(data, { kind: 'createTask', id, listId: 'default', title });
  return data;
}
