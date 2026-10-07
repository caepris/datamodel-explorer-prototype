import { useMemo, useState } from 'react'
import { CATEGORY_ORDER, getAllProperties, getClass, getClassChain, getVisibleProperties } from '../../model/classCatalog'
import { normalizePropertyPath, propertyKey } from '../../model/propertyTree'
import { getFullName } from '../../model/tree'
import type { PropertySchema } from '../../model/types'
import { defaultVariant } from '../../model/variants'
import { useDataModel } from '../../state/useDataModel'
import { ClassGlyph } from '../ClassGlyph'
import { AttributesSection } from './AttributesSection'
import { PropertyRow } from './PropertyRow'
import { BulkPropertyDialog } from './BulkPropertyDialog'
import { PropertySchemaDialog } from './PropertySchemaDialog'
import { StudioPropertyExportDialog } from './StudioPropertyExportDialog'

function nextCategoryPropertyName(existingNames: string[]): string {
  const taken = new Set(existingNames)
  if (!taken.has('Property')) return 'Property'
  let n = 2
  let candidate = `Property${n}`
  while (taken.has(candidate)) {
    n += 1
    candidate = `Property${n}`
  }
  return candidate
}

function groupByCategory(properties: PropertySchema[]): [string, PropertySchema[]][] {
  const groups = new Map<string, PropertySchema[]>()
  for (const prop of properties) {
    const list = groups.get(prop.category) ?? []
    list.push(prop)
    groups.set(prop.category, list)
  }
  const rank = (category: string) => {
    const index = CATEGORY_ORDER.indexOf(category)
    return index === -1 ? CATEGORY_ORDER.length : index
  }
  return [...groups.entries()].sort(([a], [b]) => rank(a) - rank(b))
}

function filterPropertyTree(schema: PropertySchema, query: string): PropertySchema | null {
  if (!query || schema.name.toLowerCase().includes(query)) return schema
  const children = (schema.children ?? [])
    .map((child) => filterPropertyTree(child, query))
    .filter((child): child is PropertySchema => child !== null)
  return children.length > 0 ? { ...schema, children } : null
}

export function PropertiesPanel() {
  const { state, dispatch } = useDataModel()
  const [filter, setFilter] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [customize, setCustomize] = useState(false)
  const [editingSchema, setEditingSchema] = useState<{ schema: PropertySchema; path: string } | null>(null)
  const [addingProperty, setAddingProperty] = useState(false)
  const [bulkAdding, setBulkAdding] = useState(false)
  const [addingSubproperty, setAddingSubproperty] = useState<{ path: string; category: string } | null>(null)
  const [dragPath, setDragPath] = useState<string | null>(null)
  const [categoryDrop, setCategoryDrop] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const node = state.selectedId ? state.nodes[state.selectedId] : undefined

  const groups = useMemo(() => {
    if (!node) return []
    const q = filter.trim().toLowerCase()
    const props = getVisibleProperties(node.className, state.classOverlays)
      .map((prop) => filterPropertyTree(prop, q))
      .filter((prop): prop is PropertySchema => prop !== null)
    return groupByCategory(props)
  }, [node, filter, state.classOverlays])

  return (
    <section className="panel properties-panel" aria-label="Properties">
      <header className="panel-header">
        <h2>Properties{node ? ` — ${node.className} "${node.name}"` : ''}</h2>
        {node && (
          <div className="panel-header-actions">
            <button type="button" className="button panel-header-button" onClick={() => setExporting(true)}>
              Export
            </button>
            <button
              type="button"
              className={`button panel-header-button${customize ? ' is-active' : ''}`}
              aria-pressed={customize}
              onClick={() => setCustomize((value) => !value)}
            >
              {customize ? 'Done' : 'Customize'}
            </button>
          </div>
        )}
      </header>
      {!node ? (
        <p className="empty-state">Select an instance in the Explorer to see its properties.</p>
      ) : (
        <>
          <div className="instance-summary">
            <ClassGlyph className={node.className} size={28} />
            <div className="instance-summary-text">
              <div className="instance-summary-name">{node.name}</div>
              <code className="instance-summary-path">{getFullName(state, node.id)}</code>
              <div className="class-chain" aria-label="Class inheritance">
                {getClassChain(node.className).map((cls, index) => (
                  <span key={cls} className={getClass(cls).creatable || index === 0 ? 'chain-concrete' : 'chain-abstract'}>
                    {index > 0 && <span className="chain-sep">→</span>}
                    {cls}
                  </span>
                ))}
              </div>
              <p className="class-description">{getClass(node.className).description}</p>
            </div>
          </div>
          <div className="panel-toolbar">
            <input
              className="text-input"
              placeholder="Filter properties"
              aria-label="Filter properties"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
          </div>
          {customize && (
            <div className="customize-banner">
              <div>
                <strong>Editing {node.className}</strong>
                <span>Drag properties to reorder, recategorize, or nest them. Changes apply to every {node.className} and subclass.</span>
              </div>
              <div className="customize-actions">
                <button type="button" className="button button-primary" onClick={() => setAddingProperty(true)}>
                  + Add property
                </button>
                <button type="button" className="button" onClick={() => setBulkAdding(true)}>
                  Bulk add
                </button>
                <button
                  type="button"
                  className="button"
                  disabled={!state.classOverlays[node.className]}
                  onClick={() => dispatch({ type: 'restoreClassProperties', className: node.className })}
                >
                  Restore class
                </button>
              </div>
            </div>
          )}
          <div className="properties-scroll">
            {groups.map(([category, props]) => {
              const isCollapsed = Boolean(collapsed[category])
              const canDrag = customize && !filter.trim()
              return (
                <section key={category} className="category" aria-label={`${category} properties`}>
                  <header
                    className={`category-header${categoryDrop === category ? ' drop-inside' : ''}`}
                    onDragOver={(event) => {
                      if (!canDrag || !dragPath) return
                      event.preventDefault()
                      setCategoryDrop(category)
                    }}
                    onDragLeave={() => setCategoryDrop((current) => (current === category ? null : current))}
                    onDrop={(event) => {
                      if (!canDrag || !dragPath) return
                      event.preventDefault()
                      setCategoryDrop(null)
                      setCollapsed((current) => ({ ...current, [category]: false }))
                      dispatch({
                        type: 'moveClassProperty',
                        className: node.className,
                        propertyName: dragPath,
                        parentPath: null,
                        before: null,
                        category,
                      })
                      setDragPath(null)
                    }}
                  >
                    <button
                      type="button"
                      className="category-toggle"
                      aria-expanded={!isCollapsed}
                      onClick={() => setCollapsed((c) => ({ ...c, [category]: !c[category] }))}
                    >
                      <span className="category-chevron">{isCollapsed ? '▸' : '▾'}</span>
                      {category}
                      <span className="category-count">{props.length}</span>
                    </button>
                    {customize && (
                      <button
                        type="button"
                        className="icon-button category-add"
                        aria-label={`Add property to ${category}`}
                        title={`Add a property to ${category}`}
                        onClick={() => {
                          const names = getAllProperties(node.className, state.classOverlays).map((property) => property.name)
                          dispatch({
                            type: 'addClassProperty',
                            className: node.className,
                            property: {
                              name: nextCategoryPropertyName(names),
                              category,
                              type: 'string',
                              defaultValue: defaultVariant('string'),
                            },
                          })
                          setFilter('')
                          setCollapsed((current) => ({ ...current, [category]: false }))
                        }}
                      >
                        +
                      </button>
                    )}
                  </header>
                  {!isCollapsed && (
                    <div className="category-body">
                      {props.map((schema, index) => (
                        <PropertyRow
                          key={`${node.id}:${schema.sourcePath ?? schema.name}`}
                          node={node}
                          schema={schema}
                          forceExpanded={Boolean(filter.trim())}
                          customize={customize}
                          canDrag={canDrag}
                          dragPath={dragPath}
                          nextPath={props[index + 1]?.name ?? null}
                          onDragStart={setDragPath}
                          onDragEnd={() => {
                            setDragPath(null)
                            setCategoryDrop(null)
                          }}
                          onMoveProperty={(propertyName, parentPath, before, nextCategory) => {
                            setDragPath(null)
                            dispatch({
                              type: 'moveClassProperty',
                              className: node.className,
                              propertyName,
                              parentPath,
                              before,
                              category: nextCategory,
                            })
                          }}
                          onEditSchema={(schema, path) => setEditingSchema({ schema, path })}
                          onAddSubproperty={(schema, path) => setAddingSubproperty({ path, category: schema.category })}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )
            })}
            {groups.length === 0 && <p className="empty-hint">No properties match “{filter}”.</p>}
            {!filter && <AttributesSection key={node.id} node={node} />}
          </div>
          {exporting && <StudioPropertyExportDialog node={node} onClose={() => setExporting(false)} />}
          {bulkAdding && <BulkPropertyDialog className={node.className} onClose={() => setBulkAdding(false)} />}
          {(addingProperty || addingSubproperty || editingSchema) && (
            <PropertySchemaDialog
              className={node.className}
              property={editingSchema?.schema}
              propertyPath={editingSchema?.path}
              parentPath={
                addingSubproperty?.path ??
                (editingSchema && normalizePropertyPath(editingSchema.path).length > 1
                  ? propertyKey(normalizePropertyPath(editingSchema.path).slice(0, -1))
                  : undefined)
              }
              parentCategory={addingSubproperty?.category}
              canRenameAndRetype={
                !editingSchema ||
                (editingSchema.schema.storage !== 'name' &&
                  editingSchema.schema.storage !== 'parent' &&
                  editingSchema.schema.storage !== 'className')
              }
              onClose={() => {
                setAddingProperty(false)
                setAddingSubproperty(null)
                setEditingSchema(null)
              }}
            />
          )}
        </>
      )}
    </section>
  )
}
