import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { getClass, isService } from '../../model/classCatalog'
import { getDeleteError, getReparentError } from '../../model/dataModelReducer'
import { getAncestorIds, getDescendantIds, getInsertParent } from '../../model/tree'
import type { DataModelState, InstanceId } from '../../model/types'
import { useDataModel } from '../../state/useDataModel'
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog'
import { ExplorerRow } from './ExplorerRow'
import { InsertObjectDialog } from './InsertObjectDialog'
import { StudioExplorerExportDialog } from './StudioExplorerExportDialog'

export interface VisibleRow {
  id: InstanceId
  depth: number
}

interface ContextMenuState {
  id: InstanceId
  x: number
  y: number
}

function computeVisibleRows(state: DataModelState, filter: string): VisibleRow[] {
  const q = filter.trim().toLowerCase()
  let included: Set<InstanceId> | null = null
  if (q) {
    included = new Set()
    for (const node of Object.values(state.nodes)) {
      if (node.name.toLowerCase().includes(q) || node.className.toLowerCase().includes(q)) {
        included.add(node.id)
        for (const ancestor of getAncestorIds(state, node.id)) included.add(ancestor)
      }
    }
  }

  const rows: VisibleRow[] = []
  const visit = (id: InstanceId, depth: number) => {
    if (included && !included.has(id)) return
    rows.push({ id, depth })
    if (included || state.expanded[id]) {
      for (const child of state.nodes[id].children) visit(child, depth + 1)
    }
  }
  visit(state.rootId, 0)
  return rows
}

export function ExplorerPanel() {
  const { state, dispatch } = useDataModel()
  const [filter, setFilter] = useState('')
  const [renamingId, setRenamingId] = useState<InstanceId | null>(null)
  const [insertParentId, setInsertParentId] = useState<InstanceId | null>(null)
  const [deleteId, setDeleteId] = useState<InstanceId | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [dragId, setDragId] = useState<InstanceId | null>(null)
  const [exporting, setExporting] = useState(false)
  const treeRef = useRef<HTMLDivElement>(null)

  const rows = useMemo(() => computeVisibleRows(state, filter), [state, filter])

  const requestDelete = useCallback(
    (id: InstanceId) => {
      if (getDeleteError(state, id) === null && getDescendantIds(state, id).length > 0) {
        setDeleteId(id)
      } else {
        dispatch({ type: 'deleteInstance', id })
      }
    },
    [state, dispatch],
  )

  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    window.addEventListener('mousedown', close)
    window.addEventListener('blur', close)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('blur', close)
    }
  }, [contextMenu])

  const onTreeKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (renamingId) return
    const selectedId = state.selectedId
    const index = rows.findIndex((row) => row.id === selectedId)
    const selected = selectedId ? state.nodes[selectedId] : undefined
    const mod = event.metaKey || event.ctrlKey

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      const next = rows[Math.min(rows.length - 1, index + 1)]
      if (next) dispatch({ type: 'select', id: next.id })
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      const prev = rows[Math.max(0, index - 1)]
      if (prev) dispatch({ type: 'select', id: prev.id })
    } else if (event.key === 'ArrowRight' && selected) {
      event.preventDefault()
      if (selected.children.length > 0) dispatch({ type: 'setExpanded', id: selected.id, expanded: true })
    } else if (event.key === 'ArrowLeft' && selected) {
      event.preventDefault()
      if (state.expanded[selected.id] && selected.children.length > 0) {
        dispatch({ type: 'setExpanded', id: selected.id, expanded: false })
      } else if (selected.parentId) {
        dispatch({ type: 'select', id: selected.parentId })
      }
    } else if (event.key === 'Escape') {
      dispatch({ type: 'select', id: null })
    } else if (event.key === 'F2' && selected) {
      event.preventDefault()
      setRenamingId(selected.id)
    } else if ((event.key === 'Delete' || event.key === 'Backspace') && selected) {
      event.preventDefault()
      requestDelete(selected.id)
    } else if (mod && event.key.toLowerCase() === 'd' && selected) {
      event.preventDefault()
      dispatch({ type: 'duplicateInstance', id: selected.id })
    } else if (mod && event.key.toLowerCase() === 'i') {
      event.preventDefault()
      setInsertParentId(getInsertParent(state, selectedId))
    }
  }

  const menuNode = contextMenu ? state.nodes[contextMenu.id] : undefined
  const menuIsProtected = menuNode
    ? menuNode.parentId === null || isService(menuNode.className) || Boolean(getClass(menuNode.className).protected)
    : true

  return (
    <section className="panel explorer-panel" aria-label="Explorer">
      <header className="panel-header">
        <h2>Explorer</h2>
        <div className="panel-header-actions">
          <button type="button" className="button panel-header-button" onClick={() => setExporting(true)}>
            Export
          </button>
          <button
            type="button"
            className="icon-button"
            title="Insert Object (Ctrl+I)"
            aria-label="Insert Object"
            onClick={() => setInsertParentId(getInsertParent(state, state.selectedId))}
          >
            +
          </button>
        </div>
      </header>
      <div className="panel-toolbar">
        <input
          className="text-input"
          placeholder="Filter by name or class"
          aria-label="Filter Explorer"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
      </div>
      <div
        ref={treeRef}
        className="tree"
        role="tree"
        aria-label="DataModel tree"
        tabIndex={0}
        onKeyDown={onTreeKeyDown}
        onClick={(event) => {
          if (event.target === event.currentTarget) dispatch({ type: 'select', id: null })
        }}
      >
        {rows.map((row) => (
          <ExplorerRow
            key={row.id}
            row={row}
            filterActive={filter.trim().length > 0}
            isRenaming={renamingId === row.id}
            dragId={dragId}
            onStartRename={() => setRenamingId(row.id)}
            onFinishRename={(name) => {
              if (name !== null) dispatch({ type: 'renameInstance', id: row.id, name })
              setRenamingId(null)
              treeRef.current?.focus()
            }}
            onInsert={() => setInsertParentId(row.id)}
            onContextMenu={(x, y) => setContextMenu({ id: row.id, x, y })}
            onDragStart={() => setDragId(row.id)}
            onDragEnd={() => setDragId(null)}
            onDrop={() => {
              if (dragId) dispatch({ type: 'reparentInstance', id: dragId, parentId: row.id })
              setDragId(null)
            }}
            getDropError={() => (dragId ? getReparentError(state, dragId, row.id) : null)}
          />
        ))}
        {rows.length === 0 && <p className="empty-hint">No instances match “{filter}”.</p>}
      </div>

      {contextMenu && menuNode && (
        <div
          className="context-menu"
          role="menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {[
            {
              label: 'Insert Object…',
              disabled: menuNode.parentId === null,
              run: () => setInsertParentId(menuNode.id),
            },
            { label: 'Rename', disabled: false, run: () => setRenamingId(menuNode.id) },
            {
              label: 'Duplicate',
              disabled: menuIsProtected,
              run: () => dispatch({ type: 'duplicateInstance', id: menuNode.id }),
            },
            { label: 'Delete', disabled: menuIsProtected, run: () => requestDelete(menuNode.id) },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className="context-menu-item"
              disabled={item.disabled}
              onClick={() => {
                setContextMenu(null)
                item.run()
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {insertParentId && <InsertObjectDialog parentId={insertParentId} onClose={() => setInsertParentId(null)} />}
      {deleteId && <ConfirmDeleteDialog id={deleteId} onClose={() => setDeleteId(null)} />}
      {exporting && <StudioExplorerExportDialog onClose={() => setExporting(false)} />}
    </section>
  )
}
