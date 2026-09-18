import { useState } from 'react';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Step } from '../domain';
import { dragId, reorder, type DragItem } from '../dnd/actions';
import { Handle } from '../dnd/Handle';
import { appStore, useApp } from '../state/app';
import { ActionMenu } from './ActionMenu';
import { AddField } from './AddField';
import { EditableText } from './EditableText';
function StepRow({ step, siblings, index }: { step: Step; siblings: Step[]; index: number }) {
  const [editing, setEditing] = useState(false),
    item: DragItem = { kind: 'step', id: step.id, label: step.title, taskId: step.taskId },
    sort = useSortable({ id: dragId('step', step.id), data: item, disabled: editing });
  return (
    <li
      ref={sort.setNodeRef}
      className={`step-row ${step.isCompleted ? 'completed' : ''} ${sort.isDragging ? 'dragging' : ''} ${sort.isOver ? 'drop-target' : ''}`}
      style={{ transform: CSS.Transform.toString(sort.transform), transition: sort.transition }}
    >
      <Handle sort={sort} label={`Reorder step ${step.title}`} />
      <input
        type="checkbox"
        className="completion"
        checked={step.isCompleted}
        aria-label={`Complete step ${step.title}`}
        onChange={(e) => {
          void appStore
            .getState()
            .mutate({ kind: 'updateStep', id: step.id, completed: e.target.checked });
        }}
      />
      <EditableText
        value={step.title}
        label={`Step: ${step.title}`}
        editOnClick
        editing={editing}
        setEditing={setEditing}
        onSave={(title) => appStore.getState().mutate({ kind: 'updateStep', id: step.id, title })}
      />
      <ActionMenu
        label={`Actions for step ${step.title}`}
        actions={[
          { label: 'Rename', run: () => setEditing(true) },
          {
            label: 'Move up',
            disabled: index === 0,
            run: () => reorder(item, siblings[index - 1].id),
          },
          {
            label: 'Move down',
            disabled: index === siblings.length - 1,
            run: () => reorder(item, siblings[index + 1].id),
          },
          {
            label: 'Delete step',
            danger: true,
            run: () => {
              void appStore.getState().mutate({ kind: 'deleteStep', id: step.id });
            },
          },
        ]}
      />
    </li>
  );
}
export function Steps({ taskId }: { taskId: string }) {
  const all = useApp((s) => s.data.steps),
    steps = all.filter((s) => s.taskId === taskId).sort((a, b) => a.position - b.position);
  return (
    <section className="detail-section" aria-labelledby="steps-heading">
      <h3 id="steps-heading">Steps</h3>
      <SortableContext
        items={steps.map((s) => dragId('step', s.id))}
        strategy={verticalListSortingStrategy}
      >
        <ul className="steps">
          {steps.map((step, index) => (
            <StepRow key={step.id} step={step} siblings={steps} index={index} />
          ))}
        </ul>
      </SortableContext>
      <AddField
        label="Add a step"
        onAdd={(title) =>
          appStore.getState().mutate({ kind: 'createStep', id: crypto.randomUUID(), taskId, title })
        }
      />
    </section>
  );
}
