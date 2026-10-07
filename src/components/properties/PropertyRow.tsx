import { useRef, useState } from 'react'
import { getAllProperties, getClass, isService } from '../../model/classCatalog'
import { getReferenceError, getReparentError } from '../../model/dataModelReducer'
import { isPathEqualOrDescendant, isPropertyGated, propertyKey } from '../../model/propertyTree'
import { getFullName, getPropertyValue, walkTree } from '../../model/tree'
import type { InstanceNode, PropertySchema } from '../../model/types'
import { formatVariant, variantsEqual } from '../../model/variants'
import { useDataModel } from '../../state/useDataModel'
import { VariantEditor } from './VariantEditor'

export function PropertyRow({
  node,
  schema,
  path = schema.name,
  depth = 0,
  forceExpanded = false,
  customize,
  canDrag = false,
  dragPath = null,
  parentPath = null,
  nextPath = null,
  onDragStart,
  onDragEnd,
  onMoveProperty,
  onEditSchema,
  onAddSubproperty,
}: {
  node: InstanceNode
  schema: PropertySchema
  path?: string
  depth?: number
  forceExpanded?: boolean
  customize?: boolean
  canDrag?: boolean
  dragPath?: string | null
  parentPath?: string | null
  nextPath?: string | null
  onDragStart?: (path: string) => void
  onDragEnd?: () => void
  onMoveProperty?: (from: string, parentPath: string | null, before: string | null, category?: string) => void
  onEditSchema?: (schema: PropertySchema, path: string) => void
  onAddSubproperty?: (schema: PropertySchema, path: string) => void
}) {
  const { state, dispatch } = useDataModel()
  const [expanded, setExpanded] = useState(true)
  const [dropZone, setDropZone] = useState<'before' | 'after' | 'inside' | null>(null)
  const dropZoneRef = useRef<'before' | 'after' | 'inside' | null>(null)
  const isExpanded = expanded || forceExpanded
  const key = propertyKey(path)
  const value = getPropertyValue(node, schema, key)
  const storage = schema.storage ?? 'value'
  const parentLocked =
    storage === 'parent' && (node.parentId === null || isService(node.className) || Boolean(getClass(node.className).protected))
  const readOnly = Boolean(schema.readOnly || schema.compute || parentLocked)
  const gated = isPropertyGated(node, getAllProperties(node.className, state.classOverlays), key)
  const isModified = storage === 'value' && !readOnly && !gated && !variantsEqual(value, schema.defaultValue)
  const protectedProperty = depth === 0 && ['ClassName', 'Name', 'Parent'].includes(schema.name)
  const hasChildren = Boolean(schema.children?.length)
  const dragBlocked =
    !dragPath ||
    dragPath === key ||
    isPathEqualOrDescendant(key, dragPath) ||
    (parentPath !== null && isPathEqualOrDescendant(parentPath, dragPath))

  const referenceOptions = (() => {
    if (schema.type !== 'Instance' || readOnly) return []
    return walkTree(state)
      .filter((candidate) =>
        storage === 'parent'
          ? candidate === node.parentId || getReparentError(state, node.id, candidate) === null
          : candidate !== node.id && getReferenceError(state, node.id, key, candidate) === null,
      )
      .map((candidate) => ({ id: candidate, label: getFullName(state, candidate) }))
  })()

  let readOnlyReason = ''
  if (parentLocked) readOnlyReason = node.parentId === null ? 'The DataModel is the root.' : 'Services have a locked Parent.'
  else if (schema.compute) readOnlyReason = 'Computed by the engine.'
  else if (schema.readOnly) readOnlyReason = 'Read-only.'

  return (
    <>
      <div
        className={`property-row${readOnly ? ' is-readonly' : ''}${gated ? ' is-disabled' : ''}${dragPath === key ? ' is-dragging' : ''}${dropZone ? ` drop-${dropZone}` : ''}`}
        data-property={key}
        aria-disabled={gated || undefined}
        title={gated ? 'Disabled while a parent property is off.' : undefined}
        onDragOver={(event) => {
          if (!canDrag || dragBlocked) return
          event.preventDefault()
          if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
          const bounds = event.currentTarget.getBoundingClientRect()
          const offset = event.clientY - bounds.top
          const zone: 'before' | 'after' | 'inside' =
            bounds.height > 0 && offset > bounds.height * 0.72
              ? 'after'
              : bounds.height > 0 && offset > bounds.height * 0.28 && !protectedProperty
                ? 'inside'
                : 'before'
          dropZoneRef.current = zone
          setDropZone(zone)
        }}
        onDragLeave={() => {
          dropZoneRef.current = null
          setDropZone(null)
        }}
        onDrop={(event) => {
          if (!canDrag || !dragPath || dragBlocked) return
          event.preventDefault()
          const zone = dropZoneRef.current
          dropZoneRef.current = null
          setDropZone(null)
          if (!zone) return
          if (zone === 'inside') {
            setExpanded(true)
            onMoveProperty?.(dragPath, key, null)
          } else if (zone === 'after') {
            onMoveProperty?.(dragPath, parentPath, nextPath, parentPath ? undefined : schema.category)
          } else {
            onMoveProperty?.(dragPath, parentPath, key, parentPath ? undefined : schema.category)
          }
        }}
      >
        <div className="property-name" style={{ '--property-depth': depth } as React.CSSProperties} title={schema.description ?? schema.name}>
          {canDrag && !protectedProperty && (
            <button
              type="button"
              className="property-drag-handle"
              draggable
              aria-label={`Move ${schema.name}`}
              title="Drag to reorder, change category, or nest"
              onDragStart={(event) => {
                event.stopPropagation()
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('text/plain', key)
                onDragStart?.(key)
              }}
              onDragEnd={() => onDragEnd?.()}
            >
              ⋮⋮
            </button>
          )}
          {hasChildren ? (
            <button
              type="button"
              className="property-chevron"
              aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${schema.name} subproperties`}
              aria-expanded={isExpanded}
              onClick={() => setExpanded((current) => !current)}
            >
              {isExpanded ? '▾' : '▸'}
            </button>
          ) : (
            <span className="property-chevron-spacer" />
          )}
          <span>{schema.name}</span>
        </div>
        <div className="property-value">
          {readOnly ? (
            <span className="readonly-value" title={readOnlyReason} aria-label={`${schema.name} (read-only)`}>
              {formatVariant(value, (id) => state.nodes[id]?.name ?? '(missing)')}
            </span>
          ) : (
            <VariantEditor
              value={value}
              label={schema.name}
              multiline={schema.multiline}
              enumValues={schema.enumValues}
              min={schema.min}
              max={schema.max}
              step={schema.step}
              referenceOptions={referenceOptions}
              allowNone={storage !== 'parent'}
              disabled={gated}
              onJump={(id) => dispatch({ type: 'select', id })}
              onCommit={(next) => dispatch({ type: 'setProperty', id: node.id, property: key, value: next })}
            />
          )}
          {isModified && (
            <button
              type="button"
              className="icon-button reset-button"
              title="Reset to default"
              aria-label={`Reset ${schema.name}`}
              onClick={() => dispatch({ type: 'resetProperty', id: node.id, property: key })}
            >
              ↺
            </button>
          )}
          {customize && !protectedProperty && (
            <>
              <button
                type="button"
                className="icon-button schema-action add-subproperty"
                aria-label={`Add subproperty to ${schema.name}`}
                title={`Add a subproperty beneath ${schema.name}`}
                onClick={() => onAddSubproperty?.(schema, key)}
              >
                +
              </button>
              <button
                type="button"
                className="icon-button schema-action"
                aria-label={`Duplicate property ${schema.name}`}
                title={`Duplicate ${schema.name}`}
                onClick={() => dispatch({ type: 'duplicateClassProperty', className: node.className, propertyName: key })}
              >
                ⧉
              </button>
              <button
                type="button"
                className="icon-button schema-action"
                aria-label={`Edit property ${schema.name}`}
                title="Edit class property"
                onClick={() => onEditSchema?.(schema, key)}
              >
                ✎
              </button>
              <button
                type="button"
                className="icon-button remove-button schema-action"
                aria-label={`Delete property ${schema.name}`}
                title={`Remove ${schema.name} from ${node.className}`}
                onClick={() => dispatch({ type: 'removeClassProperty', className: node.className, propertyName: key })}
              >
                ×
              </button>
            </>
          )}
        </div>
      </div>
      {isExpanded &&
        schema.children?.map((child, index, children) => {
          const childPath = `${key}.${child.name}`
          const nextChild = children[index + 1]
          return (
            <PropertyRow
              key={`${node.id}:${childPath}`}
              node={node}
              schema={child}
              path={childPath}
              depth={depth + 1}
              forceExpanded={forceExpanded}
              customize={customize}
              canDrag={canDrag}
              dragPath={dragPath}
              parentPath={key}
              nextPath={nextChild ? `${key}.${nextChild.name}` : null}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onMoveProperty={onMoveProperty}
              onEditSchema={onEditSchema}
              onAddSubproperty={onAddSubproperty}
            />
          )
        })}
    </>
  )
}
