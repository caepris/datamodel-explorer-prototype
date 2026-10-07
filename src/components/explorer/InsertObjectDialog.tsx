import { useMemo, useState } from 'react'
import { getCreatableClasses } from '../../model/classCatalog'
import { getFullName } from '../../model/tree'
import type { InstanceId } from '../../model/types'
import { useDataModel } from '../../state/useDataModel'
import { ClassGlyph } from '../ClassGlyph'
import { Modal } from '../Modal'

interface InsertObjectDialogProps {
  parentId: InstanceId
  onClose: () => void
}

export function InsertObjectDialog({ parentId, onClose }: InsertObjectDialogProps) {
  const { state, dispatch } = useDataModel()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const classes = useMemo(() => {
    const q = query.trim().toLowerCase()
    return getCreatableClasses().filter(
      (schema) => !q || schema.className.toLowerCase().includes(q) || schema.description.toLowerCase().includes(q),
    )
  }, [query])

  const insert = (className: string) => {
    dispatch({ type: 'createInstance', className, parentId })
    onClose()
  }

  return (
    <Modal title="Insert Object" onClose={onClose}>
      <p className="dialog-subtitle">
        Inserting into <code>{getFullName(state, parentId)}</code>
      </p>
      <input
        autoFocus
        className="text-input dialog-search"
        placeholder="Search classes"
        aria-label="Search classes"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setActiveIndex(0)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setActiveIndex((i) => Math.min(classes.length - 1, i + 1))
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setActiveIndex((i) => Math.max(0, i - 1))
          } else if (event.key === 'Enter' && classes[activeIndex]) {
            insert(classes[activeIndex].className)
          }
        }}
      />
      <ul className="class-list" role="listbox" aria-label="Creatable classes">
        {classes.map((schema, index) => (
          <li key={schema.className}>
            <button
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              className={`class-option${index === activeIndex ? ' is-active' : ''}`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => insert(schema.className)}
            >
              <ClassGlyph className={schema.className} />
              <span className="class-option-name">{schema.className}</span>
              <span className="class-option-description">{schema.description}</span>
            </button>
          </li>
        ))}
        {classes.length === 0 && <li className="empty-hint">No creatable class matches “{query}”.</li>}
      </ul>
      <p className="dialog-footnote">
        Abstract classes like Instance or BasePart, and services, are not creatable, so they never appear here.
      </p>
    </Modal>
  )
}
