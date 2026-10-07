import { useState } from 'react'
import { parseBulkProperties } from '../../model/bulkProperties'
import { getBulkPropertyError } from '../../model/dataModelReducer'
import type { PropertySchema } from '../../model/types'
import { useDataModel } from '../../state/useDataModel'
import { Modal } from '../Modal'

const EXAMPLE = `Health number
MaxHealth number @Data
Team enum @Product = Red, Blue, Green
FeatureEnabled bool @Behavior gates
  RetryCount number
  Note string readonly`

interface BulkPropertyDialogProps {
  className: string
  parentPath?: string
  parentCategory?: string
  onClose: () => void
}

export function BulkPropertyDialog({ className, parentPath, parentCategory, onClose }: BulkPropertyDialogProps) {
  const { state, dispatch } = useDataModel()
  const [text, setText] = useState('')
  const parsed = text.trim() ? parseBulkProperties(text, parentCategory ?? 'Data') : null
  const properties = parsed && 'properties' in parsed ? parsed.properties : null
  const modelError = properties ? getBulkPropertyError(state, className, properties, parentPath) : null
  const count = properties ? countProperties(properties) : 0

  const submit = () => {
    if (!properties || modelError) return
    dispatch({
      type: 'addClassProperties',
      className,
      properties,
      parentPath,
    })
    onClose()
  }

  return (
    <Modal title={`Bulk add ${className} properties`} onClose={onClose}>
      <form
        className="schema-form"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <label className="schema-form-wide">
          <span>Properties</span>
          <textarea
            autoFocus
            className="value-input value-textarea bulk-property-input"
            aria-label="Bulk properties"
            placeholder={EXAMPLE}
            spellCheck={false}
            rows={10}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </label>
        {parsed && 'error' in parsed && <p className="dialog-error schema-form-wide">{parsed.error}</p>}
        {modelError && <p className="dialog-error schema-form-wide">{modelError}</p>}
        <p className="dialog-footnote schema-form-wide">
          One property per line: <code>Name type @Category</code>. Indent a line by two spaces to make it a subproperty.
          Add <code>gates</code> to a bool, <code>readonly</code> to lock editing, and <code>= A, B</code> for enum options.
          Lines starting with # are ignored.
        </p>
        <div className="dialog-actions schema-form-wide">
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button button-primary" disabled={!properties || Boolean(modelError)}>
            Add {count === 1 ? '1 property' : `${count} properties`}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function countProperties(properties: PropertySchema[]): number {
  return properties.reduce((total, property) => total + 1 + countProperties(property.children ?? []), 0)
}
