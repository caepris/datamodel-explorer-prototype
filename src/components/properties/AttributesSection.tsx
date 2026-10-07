import { useState } from 'react'
import type { AttributeType, InstanceNode } from '../../model/types'
import { ATTRIBUTE_TYPES, ATTRIBUTE_TYPE_LABELS, validateAttributeName } from '../../model/variants'
import { useDataModel } from '../../state/useDataModel'
import { TextField } from './editors'
import { VariantEditor } from './VariantEditor'

function AttributeTypeSelect({
  value,
  label,
  onChange,
}: {
  value: AttributeType
  label: string
  onChange: (type: AttributeType) => void
}) {
  return (
    <select
      className="value-input value-select attribute-type"
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value as AttributeType)}
    >
      {ATTRIBUTE_TYPES.map((type) => (
        <option key={type} value={type}>
          {ATTRIBUTE_TYPE_LABELS[type]}
        </option>
      ))}
    </select>
  )
}

export function AttributesSection({ node }: { node: InstanceNode }) {
  const { dispatch } = useDataModel()
  const [collapsed, setCollapsed] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<AttributeType>('string')
  const [error, setError] = useState<string | null>(null)

  const existingNames = node.attributes.map((attribute) => attribute.name)

  const submit = () => {
    const name = newName.trim()
    const validation = validateAttributeName(name, existingNames)
    if (validation) {
      setError(validation)
      return
    }
    dispatch({ type: 'addAttribute', id: node.id, name, attributeType: newType })
    setNewName('')
    setError(null)
    setAdding(false)
  }

  return (
    <section className="category attributes" aria-label="Attributes">
      <header className="category-header">
        <button
          type="button"
          className="category-toggle"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((c) => !c)}
        >
          <span className="category-chevron">{collapsed ? '▸' : '▾'}</span>
          Attributes
          <span className="category-count">{node.attributes.length}</span>
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="Add attribute"
          title="Add attribute"
          onClick={() => {
            setCollapsed(false)
            setAdding(true)
          }}
        >
          +
        </button>
      </header>
      {!collapsed && (
        <div className="category-body">
          <p className="attributes-hint">
            Attributes are custom key/value data any instance can carry. Unlike properties, you can add, rename, retype, and
            remove them.
          </p>
          {node.attributes.map((attribute) => (
            <div key={attribute.name} className="property-row attribute-row" data-attribute={attribute.name}>
              <div className="property-name">
                <TextField
                  className="attribute-name-input"
                  label={`Attribute name ${attribute.name}`}
                  value={attribute.name}
                  onCommit={(name) =>
                    dispatch({ type: 'renameAttribute', id: node.id, name: attribute.name, newName: name.trim() })
                  }
                />
              </div>
              <div className="property-value">
                <AttributeTypeSelect
                  value={attribute.value.type as AttributeType}
                  label={`Attribute type ${attribute.name}`}
                  onChange={(attributeType) =>
                    dispatch({ type: 'setAttributeType', id: node.id, name: attribute.name, attributeType })
                  }
                />
                <VariantEditor
                  value={attribute.value}
                  label={`Attribute ${attribute.name}`}
                  onCommit={(value) => dispatch({ type: 'setAttribute', id: node.id, name: attribute.name, value })}
                />
                <button
                  type="button"
                  className="icon-button remove-button"
                  aria-label={`Remove attribute ${attribute.name}`}
                  title="Remove attribute"
                  onClick={() => dispatch({ type: 'removeAttribute', id: node.id, name: attribute.name })}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
          {node.attributes.length === 0 && !adding && <p className="empty-hint">No attributes yet.</p>}
          {adding && (
            <form
              className="attribute-form"
              onSubmit={(event) => {
                event.preventDefault()
                submit()
              }}
            >
              <input
                autoFocus
                className="value-input"
                aria-label="New attribute name"
                placeholder="AttributeName"
                value={newName}
                onChange={(event) => {
                  setNewName(event.target.value)
                  setError(null)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setAdding(false)
                }}
              />
              <AttributeTypeSelect value={newType} label="New attribute type" onChange={setNewType} />
              <button type="submit" className="button button-primary">
                Add
              </button>
              <button type="button" className="button" onClick={() => setAdding(false)}>
                Cancel
              </button>
              {error && (
                <p className="field-error" role="alert">
                  {error}
                </p>
              )}
            </form>
          )}
        </div>
      )}
    </section>
  )
}
