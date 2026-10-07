import { useState, type KeyboardEvent } from 'react'
import { color3ToHex, formatColor3, formatNumber, hexToColor3 } from '../../model/variants'
import type { CFrame, Color3, InstanceId, Vector2, Vector3 } from '../../model/types'

/** Keeps a local draft while typing and resyncs whenever the committed value changes. */
function useDraft(value: string): [string, (next: string) => void, () => void] {
  const [draft, setDraft] = useState(value)
  const [committed, setCommitted] = useState(value)
  if (value !== committed) {
    setCommitted(value)
    setDraft(value)
  }
  return [draft, setDraft, () => setDraft(value)]
}

interface TextFieldProps {
  value: string
  label: string
  onCommit: (value: string) => void
  className?: string
}

export function TextField({ value, label, onCommit, className }: TextFieldProps) {
  const [draft, setDraft, revert] = useDraft(value)
  const commit = () => {
    if (draft !== value) onCommit(draft)
    revert()
  }
  return (
    <input
      className={`value-input ${className ?? ''}`}
      aria-label={label}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') {
          const input = event.currentTarget
          revert()
          requestAnimationFrame(() => input.blur())
        }
      }}
    />
  )
}

export function MultilineField({ value, label, onCommit }: { value: string; label: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useDraft(value)
  return (
    <textarea
      className="value-input value-textarea"
      aria-label={label}
      spellCheck={false}
      rows={Math.min(10, Math.max(3, draft.split('\n').length))}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) event.currentTarget.blur()
      }}
    />
  )
}

interface NumberFieldProps {
  value: number
  label: string
  onCommit: (value: number) => void
  min?: number
  max?: number
  step?: number
  showSlider?: boolean
}

export function NumberField({ value, label, onCommit, min, max, step, showSlider }: NumberFieldProps) {
  return (
    <div className="number-field">
      {showSlider && min !== undefined && max !== undefined && (
        <input
          type="range"
          className="value-slider"
          aria-label={`${label} slider`}
          min={min}
          max={max}
          step={step ?? (max - min) / 100}
          value={value}
          onChange={(event) => onCommit(Number(event.target.value))}
        />
      )}
      <TextField
        className="value-number"
        label={label}
        value={formatNumber(value)}
        onCommit={(text) => onCommit(text.trim() === '' ? Number.NaN : Number(text))}
      />
    </div>
  )
}

export function BoolField({ value, label, onCommit }: { value: boolean; label: string; onCommit: (v: boolean) => void }) {
  return (
    <input
      type="checkbox"
      className="value-checkbox"
      aria-label={label}
      checked={value}
      onChange={(event) => onCommit(event.target.checked)}
    />
  )
}

export function EnumField({
  value,
  options,
  label,
  onCommit,
}: {
  value: string
  options: string[]
  label: string
  onCommit: (v: string) => void
}) {
  return (
    <select className="value-input value-select" aria-label={label} value={value} onChange={(e) => onCommit(e.target.value)}>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  )
}

export function Vector3Field({
  value,
  label,
  onCommit,
}: {
  value: Vector3
  label: string
  onCommit: (v: Vector3) => void
}) {
  return (
    <div className="vector-field">
      {(['x', 'y', 'z'] as const).map((axis) => (
        <label key={axis} className="vector-component">
          <span className="vector-axis">{axis.toUpperCase()}</span>
          <TextField
            className="value-number"
            label={`${label} ${axis.toUpperCase()}`}
            value={formatNumber(value[axis])}
            onCommit={(text) => onCommit({ ...value, [axis]: text.trim() === '' ? Number.NaN : Number(text) })}
          />
        </label>
      ))}
    </div>
  )
}

export function Vector2Field({
  value,
  label,
  onCommit,
}: {
  value: Vector2
  label: string
  onCommit: (v: Vector2) => void
}) {
  return (
    <div className="vector-field vector2-field">
      {(['x', 'y'] as const).map((axis) => (
        <label key={axis} className="vector-component">
          <span className="vector-axis">{axis.toUpperCase()}</span>
          <TextField
            className="value-number"
            label={`${label} ${axis.toUpperCase()}`}
            value={formatNumber(value[axis])}
            onCommit={(text) => onCommit({ ...value, [axis]: text.trim() === '' ? Number.NaN : Number(text) })}
          />
        </label>
      ))}
    </div>
  )
}

export function CFrameField({ value, label, onCommit }: { value: CFrame; label: string; onCommit: (v: CFrame) => void }) {
  return (
    <div className="cframe-field">
      <div className="cframe-row">
        <span className="cframe-label">Position</span>
        <Vector3Field
          value={value.position}
          label={`${label} Position`}
          onCommit={(position) => onCommit({ ...value, position })}
        />
      </div>
      <div className="cframe-row">
        <span className="cframe-label">Orientation</span>
        <Vector3Field
          value={value.orientation}
          label={`${label} Orientation`}
          onCommit={(orientation) => onCommit({ ...value, orientation })}
        />
      </div>
    </div>
  )
}

export function Color3Field({ value, label, onCommit }: { value: Color3; label: string; onCommit: (v: Color3) => void }) {
  return (
    <div className="color-field">
      <input
        type="color"
        className="value-color"
        aria-label={label}
        value={color3ToHex(value)}
        onChange={(event) => onCommit(hexToColor3(event.target.value))}
      />
      <span className="color-text">{formatColor3(value)}</span>
    </div>
  )
}

export interface ReferenceOption {
  id: InstanceId
  label: string
}

export function InstanceField({
  value,
  options,
  label,
  allowNone,
  onCommit,
  onJump,
}: {
  value: InstanceId | null
  options: ReferenceOption[]
  label: string
  allowNone: boolean
  onCommit: (v: InstanceId | null) => void
  onJump: (id: InstanceId) => void
}) {
  const hasCurrent = value === null || options.some((option) => option.id === value)
  return (
    <div className="reference-field">
      <select
        className="value-input value-select"
        aria-label={label}
        value={value ?? ''}
        onChange={(event) => onCommit(event.target.value === '' ? null : event.target.value)}
      >
        {allowNone && <option value="">None</option>}
        {!hasCurrent && value && <option value={value}>(current)</option>}
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      {value && (
        <button
          type="button"
          className="icon-button reference-jump"
          title="Select referenced instance"
          aria-label={`Select ${label} target`}
          onClick={() => onJump(value)}
        >
          ↗
        </button>
      )}
    </div>
  )
}
