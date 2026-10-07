import type { Variant } from '../../model/types'
import {
  BoolField,
  CFrameField,
  Color3Field,
  EnumField,
  InstanceField,
  MultilineField,
  NumberField,
  TextField,
  Vector2Field,
  Vector3Field,
  type ReferenceOption,
} from './editors'

export interface VariantEditorProps {
  value: Variant
  label: string
  onCommit: (value: Variant) => void
  multiline?: boolean
  enumValues?: string[]
  min?: number
  max?: number
  step?: number
  referenceOptions?: ReferenceOption[]
  allowNone?: boolean
  onJump?: (id: string) => void
  disabled?: boolean
}

export function VariantEditor(props: VariantEditorProps) {
  const { value, label, onCommit } = props
  let editor
  switch (value.type) {
    case 'string':
      editor = props.multiline ? (
        <MultilineField value={value.value} label={label} onCommit={(v) => onCommit({ type: 'string', value: v })} />
      ) : (
        <TextField value={value.value} label={label} onCommit={(v) => onCommit({ type: 'string', value: v })} />
      )
      break
    case 'bool':
      editor = <BoolField value={value.value} label={label} onCommit={(v) => onCommit({ type: 'bool', value: v })} />
      break
    case 'number':
      editor = (
        <NumberField
          value={value.value}
          label={label}
          min={props.min}
          max={props.max}
          step={props.step}
          showSlider={props.min !== undefined && props.max !== undefined}
          onCommit={(v) => onCommit({ type: 'number', value: v })}
        />
      )
      break
    case 'enum':
      editor = (
        <EnumField
          value={value.value}
          options={props.enumValues ?? [value.value]}
          label={label}
          onCommit={(v) => onCommit({ type: 'enum', value: v })}
        />
      )
      break
    case 'Vector3':
      editor = <Vector3Field value={value.value} label={label} onCommit={(v) => onCommit({ type: 'Vector3', value: v })} />
      break
    case 'Vector2':
      editor = <Vector2Field value={value.value} label={label} onCommit={(v) => onCommit({ type: 'Vector2', value: v })} />
      break
    case 'CFrame':
      editor = <CFrameField value={value.value} label={label} onCommit={(v) => onCommit({ type: 'CFrame', value: v })} />
      break
    case 'Color3':
      editor = <Color3Field value={value.value} label={label} onCommit={(v) => onCommit({ type: 'Color3', value: v })} />
      break
    case 'Instance':
      editor = (
        <InstanceField
          value={value.value}
          label={label}
          options={props.referenceOptions ?? []}
          allowNone={props.allowNone ?? true}
          onCommit={(v) => onCommit({ type: 'Instance', value: v })}
          onJump={(id) => props.onJump?.(id)}
        />
      )
      break
  }
  return (
    <fieldset className="variant-editor-fieldset" disabled={props.disabled} aria-label={props.disabled ? `${label} disabled` : undefined}>
      {editor}
    </fieldset>
  )
}