import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ListTodo, Plus, Search, X, Settings, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { usePreferences } from '../settings/preferences';
import { runCommand } from '../settings/actions';
import { useUi } from '../state/ui';
import type { List } from '../domain';
import { appStore, notes, useApp } from '../state/app';
import { dragId, reorder, type DragItem } from '../dnd/actions';
import { Handle } from '../dnd/Handle';
import { ActionMenu } from './ActionMenu';
import { AddField } from './AddField';
import { Confirm } from './Confirm';
import { EditableText } from './EditableText';
function ListRow({ list, index, custom }: { list: List; index: number; custom: List[] }) {
  const selected = useApp((s) => s.selectedListId === list.id && !s.search.trim()),
    count = useApp(
      (s) =>
        s.data.tasks.filter((t) => t.listId === list.id && !t.parentId && !t.isCompleted).length,
    );
  const editing = useUi((s) => s.editingListId === list.id),
    deleting = useUi((s) => s.deletingListId === list.id),
    item: DragItem = { kind: 'list', id: list.id, label: list.name };
  const setEditing = (value: boolean) => useUi.setState({ editingListId: value ? list.id : null });
  const setDeleting = (value: boolean) =>
    useUi.setState({ deletingListId: value ? list.id : null });
  const sort = useSortable({
      id: dragId('list', list.id),
      data: item,
      disabled: list.isDefault || editing,
    }),
    drop = useDroppable({
      id: dragId('list-drop', list.id),
      data: { kind: 'list-drop', id: list.id, label: list.name } satisfies DragItem,
    });
  return (
    <div
      ref={sort.setNodeRef}
      style={{ transform: CSS.Transform.toString(sort.transform), transition: sort.transition }}
    >
      <div
        ref={drop.setNodeRef}
        data-list-id={list.id}
        className={`list-row ${selected ? 'selected' : ''} ${drop.isOver || sort.isOver ? 'drop-target' : ''} ${sort.isDragging ? 'dragging' : ''}`}
      >
        {list.isDefault ? (
          <ListTodo size={18} className="list-icon" />
        ) : (
          <Handle sort={sort} label={`Reorder list ${list.name}`} />
        )}
        {list.isDefault ? (
          <button
            type="button"
            className="editable-text"
            aria-current={selected ? 'page' : undefined}
            onClick={() => appStore.getState().selectList(list.id)}
          >
            {list.name}
          </button>
        ) : (
          <EditableText
            value={list.name}
            label={`List: ${list.name}`}
            editing={editing}
            setEditing={setEditing}
            onSelect={() => appStore.getState().selectList(list.id)}
            onSave={(name) => appStore.getState().mutate({ kind: 'renameList', id: list.id, name })}
          />
        )}
        {count > 0 && (
          <span className="count" aria-label={`${count} active tasks`}>
            {count}
          </span>
        )}
        {!list.isDefault && (
          <ActionMenu
            label={`Actions for list ${list.name}`}
            actions={[
              { label: 'Rename', run: () => setEditing(true) },
              {
                label: 'Move up',
                disabled: index === 0,
                run: () => reorder(item, custom[index - 1].id),
              },
              {
                label: 'Move down',
                disabled: index === custom.length - 1,
                run: () => reorder(item, custom[index + 1].id),
              },
              { label: 'Delete list…', danger: true, run: () => setDeleting(true) },
            ]}
          />
        )}
      </div>
      {deleting && (
        <Confirm
          title={`Delete “${list.name}”?`}
          message="This permanently deletes the list, all its tasks and steps, and their attached images."
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            const ids = appStore
              .getState()
              .data.tasks.filter((t) => t.listId === list.id)
              .map((t) => t.id);
            for (const id of ids) if (!(await notes.flush(id))) return false;
            const ok = await appStore.getState().mutate({ kind: 'deleteList', id: list.id });
            if (ok) ids.forEach(notes.discard);
            return ok;
          }}
        />
      )}
    </div>
  );
}
export function Sidebar() {
  const collapsed = usePreferences((s) => s.sidebarCollapsed);
  const lists = useApp((s) => s.data.lists),
    search = useApp((s) => s.search),
    [adding, setAdding] = useState(false),
    custom = lists.filter((l) => !l.isDefault);
  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`} aria-label="Lists">
      <div className="brand">
        {!collapsed && (
          <>
            <ListTodo size={21} />
            <span>Clearlist</span>
          </>
        )}
        <button
          type="button"
          className="icon-button sidebar-toggle"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          aria-controls="sidebar-content"
          onClick={() => usePreferences.getState().toggleSidebar()}
        >
          {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
        </button>
      </div>
      {collapsed && (
        <div className="sidebar-rail">
          <button
            type="button"
            className="icon-button"
            aria-label="Jump to task search"
            title="Search"
            onClick={() => runCommand('search')}
          >
            <Search size={18} />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Jump to New list"
            title="New list"
            onClick={() => runCommand('newList')}
          >
            <Plus size={18} />
          </button>
        </div>
      )}
      <div id="sidebar-content" className="sidebar-content" hidden={collapsed}>
        <div className="search-field">
          <Search size={16} aria-hidden="true" />
          <input
            id="search"
            autoComplete="off"
            type="search"
            aria-label="Search all tasks"
            placeholder="Search all tasks"
            value={search}
            onChange={(e) => appStore.getState().setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="icon-button"
              aria-label="Clear search"
              onClick={() => appStore.getState().setSearch('')}
            >
              <X size={14} />
            </button>
          )}
        </div>
        <nav className="list-nav" aria-label="Task lists">
          {lists
            .filter((l) => l.isDefault)
            .map((list) => (
              <ListRow key={list.id} list={list} index={0} custom={custom} />
            ))}
          {custom.length > 0 && <div className="sidebar-divider" />}
          <SortableContext
            items={custom.map((l) => dragId('list', l.id))}
            strategy={verticalListSortingStrategy}
          >
            {custom.map((list, index) => (
              <ListRow key={list.id} list={list} index={index} custom={custom} />
            ))}
          </SortableContext>
        </nav>
      </div>
      <div className="sidebar-bottom">
        <div hidden={collapsed}>
          {adding && (
            <AddField
              label="List name"
              autoFocus
              onCancel={() => setAdding(false)}
              onAdd={async (name) => {
                const id = crypto.randomUUID(),
                  ok = await appStore.getState().mutate({ kind: 'createList', id, name });
                if (ok) {
                  appStore.getState().selectList(id);
                  setAdding(false);
                }
                return ok;
              }}
            />
          )}
          <button
            type="button"
            id="new-list"
            className="new-list-button"
            onClick={() => setAdding(true)}
          >
            <Plus size={18} />
            New list
          </button>
        </div>
        <button
          type="button"
          className="settings-button"
          aria-label="Settings"
          title="Settings"
          onClick={() => useUi.getState().openSettings()}
        >
          <Settings size={18} />
          {!collapsed && <span>Settings</span>}
        </button>
      </div>
    </aside>
  );
}
