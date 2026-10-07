import type { DataModelState, InstanceId, InstanceNode, PropertySchema, Variant } from './types'
import { propertyKey, type PropertyPathInput } from './propertyTree'

export function getNode(state: DataModelState, id: InstanceId | null | undefined): InstanceNode | undefined {
  return id ? state.nodes[id] : undefined
}

/** True if `id` is `ancestorId` or lives somewhere beneath it. */
export function isDescendantOrSelf(state: DataModelState, id: InstanceId, ancestorId: InstanceId): boolean {
  let current: InstanceId | null = id
  while (current) {
    if (current === ancestorId) return true
    current = state.nodes[current]?.parentId ?? null
  }
  return false
}

export function getDescendantIds(state: DataModelState, id: InstanceId): InstanceId[] {
  const result: InstanceId[] = []
  const stack = [...(state.nodes[id]?.children ?? [])]
  while (stack.length > 0) {
    const next = stack.pop()!
    result.push(next)
    stack.push(...(state.nodes[next]?.children ?? []))
  }
  return result
}

export function getAncestorIds(state: DataModelState, id: InstanceId): InstanceId[] {
  const result: InstanceId[] = []
  let current = state.nodes[id]?.parentId ?? null
  while (current) {
    result.push(current)
    current = state.nodes[current]?.parentId ?? null
  }
  return result
}

/**
 * Dotted path like `game.Workspace.Level.SpawnPad`, matching Instance:GetFullName()
 * except that the root is shown as `game`.
 */
export function getFullName(state: DataModelState, id: InstanceId): string {
  const parts: string[] = []
  let current: InstanceId | null = id
  while (current) {
    const node: InstanceNode | undefined = state.nodes[current]
    if (!node) break
    parts.unshift(node.parentId === null ? 'game' : node.name)
    current = node.parentId
  }
  return parts.join('.')
}

export function getPropertyValue(
  node: InstanceNode,
  schema: PropertySchema,
  path: PropertyPathInput = schema.name,
): Variant {
  if (schema.compute) return schema.compute(node)
  switch (schema.storage ?? 'value') {
    case 'name':
      return { type: 'string', value: node.name }
    case 'className':
      return { type: 'string', value: node.className }
    case 'parent':
      return { type: 'Instance', value: node.parentId }
    case 'value':
      return node.properties[propertyKey(path)] ?? schema.defaultValue
  }
}

/** Where Insert Object places a new instance: the selection, unless that is the root. */
export function getInsertParent(state: DataModelState, selectedId: InstanceId | null): InstanceId {
  const selected = selectedId ? state.nodes[selectedId] : undefined
  if (selected && selected.parentId !== null) return selected.id
  const workspace = state.nodes[state.rootId].children.find((id) => state.nodes[id].className === 'Workspace')
  return workspace ?? state.rootId
}

/** Depth-first order of every instance, as the Explorer would list it fully expanded. */
export function walkTree(state: DataModelState, id: InstanceId = state.rootId): InstanceId[] {
  const node = state.nodes[id]
  if (!node) return []
  return [id, ...node.children.flatMap((child) => walkTree(state, child))]
}