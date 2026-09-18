import { describe, expect, it } from 'vitest';
import { cleanTitle, searchTasks, taskOrder } from '../domain';
import { optimistic } from '../state/reducer';
import { populated } from './fixtures';
describe('domain behavior', () => {
  it('validates titles but allows duplicate titles with independent identities', () => {
    expect(() => cleanTitle(' \n ')).toThrow();
    expect(() => cleanTitle('x'.repeat(501))).toThrow();
    expect(cleanTitle(' Build ')).toBe('Build');
    const data = optimistic(populated(), {
      kind: 'createTask',
      id: 'd',
      listId: 'default',
      title: 'Build circuit',
    });
    expect(data.tasks.filter((t) => t.title === 'Build circuit')).toHaveLength(2);
  });
  it('searches case-insensitively through titles, notes and steps across lists', () => {
    let data = populated();
    data = optimistic(data, { kind: 'createList', id: 'other', name: 'Projects' });
    data = optimistic(data, { kind: 'moveTask', id: 'b', listId: 'other' });
    data = optimistic(data, { kind: 'updateTask', id: 'b', notes: 'first line\nPCB components' });
    data = optimistic(data, {
      kind: 'createStep',
      id: 'step',
      taskId: 'c',
      title: 'Review PCB layout',
    });
    expect(searchTasks(data, 'pCb').map((t) => t.id)).toEqual(['b', 'c']);
    expect(searchTasks(data, 'BUILD')[0].id).toBe('a');
    expect(searchTasks(data, '   ')).toEqual([]);
  });
  it('retains a completed task’s saved slot while active tasks reorder', () => {
    let data = optimistic(populated(), { kind: 'completeTask', id: 'b', completed: true });
    data = optimistic(data, {
      kind: 'reorderTasks',
      listId: 'default',
      completed: false,
      ids: ['c', 'a'],
    });
    data = optimistic(data, { kind: 'completeTask', id: 'b', completed: false });
    expect(taskOrder(data.tasks, 'default', false).map((t) => t.id)).toEqual(['c', 'b', 'a']);
  });
  it('reorders steps independently and normalizes after deletion', () => {
    let data = populated();
    for (const id of ['s1', 's2', 's3'])
      data = optimistic(data, { kind: 'createStep', id, taskId: 'a', title: id });
    data = optimistic(data, { kind: 'reorderSteps', taskId: 'a', ids: ['s3', 's1', 's2'] });
    data = optimistic(data, { kind: 'deleteStep', id: 's1' });
    expect(
      data.steps.sort((a, b) => a.position - b.position).map((s) => [s.id, s.position]),
    ).toEqual([
      ['s3', 0],
      ['s2', 1],
    ]);
    expect(data.tasks.map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });
  it('searches several thousand tasks with steps', () => {
    const data = populated(),
      base = data.tasks[0];
    data.tasks = Array.from({ length: 6000 }, (_, i) => ({
      ...base,
      id: `t${i}`,
      title: `Task ${i}`,
      position: i,
      notes: i === 5724 ? 'Rare target phrase' : '',
    }));
    data.steps = Array.from({ length: 6000 }, (_, i) => ({
      id: `s${i}`,
      taskId: `t${i}`,
      title: `Step ${i}`,
      position: 0,
      isCompleted: false,
      createdAt: '',
      updatedAt: '',
    }));
    expect(searchTasks(data, 'RARE TARGET').map((t) => t.id)).toEqual(['t5724']);
    expect(searchTasks(data, 'Step 5900').map((t) => t.id)).toEqual(['t5900']);
  });
});
