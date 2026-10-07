import { useRef, useState } from 'react'
import { getClass, isService } from '../../model/classCatalog'
import { useDataModel } from '../../state/useDataModel'
import { ClassGlyph } from '../ClassGlyph'
import type { VisibleRow } from './ExplorerPanel'

interface ExplorerRowProps {
  row: VisibleRow
  filterActive: boolean
  isRenaming: boolean
  dragId: string | null
  onStartRename: () => void
  onFinishRename: (name: string | null) => void
  onInsert: () => void
  onContextMenu: (x: number, y: number) => void
  onDragStart: () => void
  onDragEnd: () => void
  onDrop: () => void
  getDropError: () => string | null
}

export function ExplorerRow({
  row,
  filterActive,
  isRenaming,
  dragId,
  onStartRename,
  onFinishRename,
  onInsert,
  onContextMenu,
  onDragStart,
  onDragEnd,
  onDrop,
  getDropError,
}: ExplorerRowProps) {
  const { state, dispatch } = useDataModel()
  const node = state.nodes[row.id]
  const [dropState, setDropState] = useState<'valid' | 'invalid' | null>(null)
  const [draftName, setDraftName] = useState(node.name)
  const [wasRenaming, setWasRenaming] = useState(isRenaming)
  const renameDone = useRef(false)
  if (isRenaming !== wasRenaming) {
    setWasRenaming(isRenaming)
    if (isRenaming) setDraftName(node.name)
  }

  const finishRename = (name: string | null) => {
    if (renameDone.current) return
    renameDone.current = true
    onFinishRename(name)
  }

  const isRoot = node.parentId === null
  const isProtected = isRoot || isService(node.className) || Boolean(getClass(node.className).protected)
  const hasChildren = node.children.length > 0
  const isExpanded = filterActive || Boolean(state.expanded[node.id])
  const isSelected = state.selectedId === node.id

  const classes = ['tree-row']
  if (isSelected) classes.push('is-selected')
  if (dropState) classes.push(`drop-${dropState}`)
  if (dragId === node.id) classes.push('is-dragging')

  return (
    <div
      className={classes.join(' ')}
      role="treeitem"
      aria-selected={isSelected}
      aria-expanded={hasChildren ? isExpanded : undefined}
      aria-level={row.depth + 1}
      data-instance-id={node.id}
      style={{ paddingLeft: 6 + row.depth * 16 }}
      draggable={!isProtected && !isRenaming}
      onClick={() => dispatch({ type: 'select', id: node.id })}
      onDoubleClick={(event) => {
        if (event.target instanceof HTMLElement && event.target.closest('.tree-row-name')) onStartRename()
      }}
      onContextMenu={(event) => {
        event.preventDefault()
        dispatch({ type: 'select', id: node.id })
        onContextMenu(event.clientX, event.clientY)
      }}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', node.id)
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      title={dropState === 'invalid' ? (getDropError() ?? undefined) : undefined}
      onDragOver={(event) => {
        if (!dragId || dragId === node.id) return
        event.preventDefault()
        // Invalid targets still accept the drop so the reducer can explain the rejection.
        event.dataTransfer.dropEffect = 'move'
        setDropState(getDropError() === null ? 'valid' : 'invalid')
      }}
      onDragLeave={() => setDropState(null)}
      onDrop={(event) => {
        event.preventDefault()
        setDropState(null)
        onDrop()
      }}
    >
      <button
        type="button"
        className={`tree-chevron${hasChildren ? '' : ' is-empty'}`}
        aria-label={hasChildren ? (isExpanded ? `Collapse ${node.name}` : `Expand ${node.name}`) : undefined}
        aria-hidden={hasChildren ? undefined : true}
        tabIndex={-1}
        onClick={(event) => {
          event.stopPropagation()
          if (hasChildren && !filterActive) dispatch({ type: 'toggleExpanded', id: node.id })
        }}
      >
        {hasChildren ? (isExpanded ? '▾' : '▸') : ''}
      </button>
      <ClassGlyph className={node.className} />
      {isRenaming ? (
        <input
          className="tree-rename-input"
          aria-label={`Rename ${node.name}`}
          autoFocus
          value={draftName}
          onFocus={(event) => {
            renameDone.current = false
            event.target.select()
          }}
          onChange={(event) => setDraftName(event.target.value)}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            event.stopPropagation()
            if (event.key === 'Enter') finishRename(draftName)
            if (event.key === 'Escape') finishRename(null)
          }}
          onBlur={() => finishRename(draftName)}
        />
      ) : (
        <span className="tree-row-name" title={`${node.name} (${node.className})`}>
          {node.name}
        </span>
      )}
      {isProtected && !isRoot && <span className="tree-row-badge">{isService(node.className) ? 'service' : 'locked'}</span>}
      {!isRoot && !isRenaming && (
        <button
          type="button"
          className="tree-row-insert"
          title={`Insert into ${node.name}`}
          aria-label={`Insert into ${node.name}`}
          tabIndex={-1}
          onClick={(event) => {
            event.stopPropagation()
            dispatch({ type: 'select', id: node.id })
            onInsert()
          }}
        >
          +
        </button>
      )}
    </div>
  )
}
