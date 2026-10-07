import { CATEGORY_ORDER, getVisibleProperties } from './classCatalog'
import { propertyKey } from './propertyTree'
import { getPropertyValue } from './tree'
import type { Color3, DataModelState, InstanceNode, PropertySchema, Variant } from './types'
import { formatColor3, formatNumber, formatVariant } from './variants'

export type StudioArrow = 'none' | 'right' | 'down'

export type StudioPropertyValue =
  | { type: 'text'; text: string }
  | { type: 'check'; checked: boolean }
  | { type: 'color'; text: string; hex: string }
  | { type: 'none' }

export interface StudioPropertyRow {
  kind: 'category' | 'property'
  label: string
  depth: number
  arrow: StudioArrow
  value: StudioPropertyValue
}

export function studioPropertyTitle(className: string, name: string): string {
  return `Properties - ${className} "${name}"`
}

export function buildStudioPropertyRows(state: DataModelState, node: InstanceNode): StudioPropertyRow[] {
  const groups = new Map<string, PropertySchema[]>()
  for (const prop of getVisibleProperties(node.className, state.classOverlays)) {
    const list = groups.get(prop.category) ?? []
    list.push(prop)
    groups.set(prop.category, list)
  }
  const rank = (category: string) => {
    const index = CATEGORY_ORDER.indexOf(category)
    return index === -1 ? CATEGORY_ORDER.length : index
  }
  const rows: StudioPropertyRow[] = []
  for (const [category, properties] of [...groups.entries()].sort(([a], [b]) => rank(a) - rank(b))) {
    rows.push({ kind: 'category', label: category, depth: 0, arrow: 'down', value: { type: 'none' } })
    for (const property of properties) appendProperty(rows, state, node, property, property.name, 0)
  }
  return rows
}

function appendProperty(
  rows: StudioPropertyRow[],
  state: DataModelState,
  node: InstanceNode,
  schema: PropertySchema,
  path: string,
  depth: number,
) {
  const value = getPropertyValue(node, schema, path)
  const children = schema.children ?? []
  const composite = children.length === 0 && (value.type === 'Vector2' || value.type === 'Vector3' || value.type === 'CFrame')
  const expanded = children.length > 0 || value.type === 'CFrame'
  rows.push({
    kind: 'property',
    label: schema.name,
    depth,
    arrow: children.length > 0 || composite ? (expanded ? 'down' : 'right') : 'none',
    value: value.type === 'CFrame' && children.length === 0 ? { type: 'none' } : studioValue(state, value),
  })
  if (value.type === 'CFrame' && children.length === 0) {
    rows.push(vectorRow('Position', depth + 1, value.value.position))
    rows.push(vectorRow('Orientation', depth + 1, value.value.orientation))
  }
  for (const child of children) appendProperty(rows, state, node, child, propertyKey([path, child.name]), depth + 1)
}

function vectorRow(label: string, depth: number, value: { x: number; y: number; z: number }): StudioPropertyRow {
  return {
    kind: 'property',
    label,
    depth,
    arrow: 'right',
    value: { type: 'text', text: `${formatNumber(value.x)}, ${formatNumber(value.y)}, ${formatNumber(value.z)}` },
  }
}

function studioValue(state: DataModelState, value: Variant): StudioPropertyValue {
  if (value.type === 'bool') return { type: 'check', checked: value.value }
  if (value.type === 'Color3') return { type: 'color', text: formatColor3(value.value), hex: colorHex(value.value) }
  if (value.type === 'Instance') {
    const name = value.value ? state.nodes[value.value]?.name : ''
    return { type: 'text', text: name ?? '' }
  }
  return { type: 'text', text: formatVariant(value, (id) => state.nodes[id]?.name ?? '') }
}

function colorHex({ r, g, b }: Color3): string {
  const channel = (channelValue: number) =>
    Math.round(Math.min(1, Math.max(0, channelValue)) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${channel(r)}${channel(g)}${channel(b)}`
}
