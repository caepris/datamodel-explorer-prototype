import { useState } from 'react'
import { CATEGORY_ORDER } from '../../model/classCatalog'
import type { PropertySchema, VariantType } from '../../model/types'
import { defaultVariant } from '../../model/variants'
import { useDataModel } from '../../state/useDataModel'
import { Modal } from '../Modal'
import { VariantEditor } from './VariantEditor'

const PROPERTY_TYPES: VariantType[] = [
  'string',
  'bool',
  'number',
  'enum',
  'Vector2',
  'Vector3',
  'CFrame',
  'Color3',
  'Instance',
]

interface PropertySchemaDialogProps {
  className: string
  property?: PropertySchema
  propertyPath?: string
  parentPath?: string
  parentCategory?: string
  canRenameAndRetype?: boolean
  onClose: () => void
}

export function PropertySchemaDialog({
  className,
  property,
  propertyPath,
  parentPath,
  parentCategory,
  canRenameAndRetype = true,
  onClose,
}: PropertySchemaDialogProps) {
  const { dispatch } = useDataModel()
  const [draft, setDraft] = useState<PropertySchema>(
    property
      ? {
          ...property,
          defaultValue: structuredClone(property.defaultValue),
          enumValues: property.enumValues ? [...property.enumValues] : undefined,
        }
      : {
          name: '',
          category: parentCategory ?? 'Data',
          type: 'string',
          defaultValue: defaultVariant('string'),
          description: '',
        },
  )
  const [enumText, setEnumText] = useState((property?.enumValues ?? ['Default', 'Option']).join(', '))

  const setType = (type: VariantType) => {
    const enumValues = type === 'enum' ? enumText.split(',').map((item) => item.trim()).filter(Boolean) : undefined
    setDraft({
      ...draft,
      type,
      enumValues,
      defaultValue: defaultVariant(type, enumValues),
      gatesChildren: type === 'bool' ? draft.gatesChildren : undefined,
    })
  }

  const submit = () => {
    const name = draft.name.trim()
    const enumValues =
      draft.type === 'enum'
        ? enumText
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
        : undefined
    const final: PropertySchema = {
      ...draft,
      name,
      category: draft.category.trim() || 'Data',
      description: draft.description?.trim(),
      enumValues,
      defaultValue:
        draft.type === 'enum' && (!enumValues?.includes(String(draft.defaultValue.value)) || enumValues.length === 0)
          ? defaultVariant('enum', enumValues)
          : draft.defaultValue,
    }
    if (property) {
      dispatch({ type: 'updateClassProperty', className, propertyName: propertyPath ?? property.name, property: final })
    } else {
      dispatch({ type: 'addClassProperty', className, property: final, parentPath })
    }
    onClose()
  }

  return (
    <Modal title={`${property ? 'Edit' : 'Add'} ${className} ${parentPath ? 'subproperty' : 'property'}`} onClose={onClose}>
      <form
        className="schema-form"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <label>
          <span>Name</span>
          <input
            autoFocus
            className="text-input"
            aria-label="Property name"
            value={draft.name}
            disabled={!canRenameAndRetype}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
        </label>
        <label>
          <span>Type</span>
          <select
            className="value-input value-select"
            aria-label="Property type"
            value={draft.type}
            disabled={!canRenameAndRetype}
            onChange={(event) => setType(event.target.value as VariantType)}
          >
            {PROPERTY_TYPES.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Category</span>
          <input
            className="text-input"
            list="property-categories"
            aria-label="Property category"
            value={draft.category}
            disabled={Boolean(parentPath)}
            onChange={(event) => setDraft({ ...draft, category: event.target.value })}
          />
          <datalist id="property-categories">
            {CATEGORY_ORDER.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </label>
        {draft.type === 'enum' && (
          <label className="schema-form-wide">
            <span>Options (comma separated)</span>
            <input
              className="text-input"
              aria-label="Enum options"
              value={enumText}
              onChange={(event) => {
                const text = event.target.value
                const values = text.split(',').map((item) => item.trim()).filter(Boolean)
                setEnumText(text)
                setDraft({
                  ...draft,
                  enumValues: values,
                  defaultValue: values.includes(String(draft.defaultValue.value))
                    ? draft.defaultValue
                    : defaultVariant('enum', values),
                })
              }}
            />
          </label>
        )}
        <label className="schema-form-wide">
          <span>Description</span>
          <input
            className="text-input"
            aria-label="Property description"
            value={draft.description ?? ''}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
          />
        </label>
        <label className="schema-checkbox">
          <input
            type="checkbox"
            checked={Boolean(draft.readOnly)}
            onChange={(event) => setDraft({ ...draft, readOnly: event.target.checked })}
          />
          <span>Read-only in the Properties panel</span>
        </label>
        {draft.type === 'bool' && (
          <label className="schema-checkbox">
            <input
              type="checkbox"
              checked={Boolean(draft.gatesChildren)}
              onChange={(event) => setDraft({ ...draft, gatesChildren: event.target.checked })}
            />
            <span>Use this checkbox to enable subproperties</span>
          </label>
        )}
        <div className="schema-default schema-form-wide">
          <span>Default value</span>
          <VariantEditor
            value={draft.defaultValue}
            label="Property default value"
            enumValues={draft.enumValues}
            onCommit={(defaultValue) => setDraft({ ...draft, defaultValue })}
          />
        </div>
        <p className="dialog-footnote schema-form-wide">
          {parentPath ? `This property will appear beneath ${parentPath}. ` : ''}
          This changes the class design in this visual prototype. Every {className} and subclass instance inherits it.
        </p>
        <div className="dialog-actions schema-form-wide">
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button button-primary" disabled={!draft.name.trim()}>
            {property ? 'Save property' : 'Add property'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
