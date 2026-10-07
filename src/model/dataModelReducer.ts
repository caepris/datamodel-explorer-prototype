import {
  getAllProperties,
  getCanonicalProperties,
  getClass,
  getDefaultProperties,
  getPropertySchema,
  isA,
  isBuiltInProperty,
  isService,
} from './classCatalog'
import {
  appendPropertyPath,
  findPropertySchema,
  flattenPropertySchemas,
  getPropertySiblings,
  isPathEqualOrDescendant,
  isPropertyGated,
  normalizePropertyPath,
  propertyKey,
  propertyLabel,
  removePropertySchema,
  replacePathPrefix,
  updatePropertySchema,
} from './propertyTree'
import { createSeedState } from './seed'
import { getDescendantIds, getFullName, getPropertyValue, isDescendantOrSelf } from './tree'
import type {
  AttributeType,
  ClassPropertyOverlay,
  DataModelState,
  InstanceId,
  InstanceNode,
  NoticeKind,
  PropertyPlacement,
  PropertySchema,
  Variant,
} from './types'
import { MAX_NAME_LENGTH, defaultAttributeValue, validateAttributeName, validateVariant } from './variants'

export type DataModelAction =
  | { type: 'select'; id: InstanceId | null }
  | { type: 'toggleExpanded'; id: InstanceId }
  | { type: 'setExpanded'; id: InstanceId; expanded: boolean }
  | { type: 'createInstance'; className: string; parentId: InstanceId }
  | { type: 'duplicateInstance'; id: InstanceId }
  | { type: 'deleteInstance'; id: InstanceId }
  | { type: 'renameInstance'; id: InstanceId; name: string }
  | { type: 'reparentInstance'; id: InstanceId; parentId: InstanceId }
  | { type: 'setProperty'; id: InstanceId; property: string; value: Variant }
  | { type: 'resetProperty'; id: InstanceId; property: string }
  | { type: 'addAttribute'; id: InstanceId; name: string; attributeType: AttributeType }
  | { type: 'setAttribute'; id: InstanceId; name: string; value: Variant }
  | { type: 'renameAttribute'; id: InstanceId; name: string; newName: string }
  | { type: 'setAttributeType'; id: InstanceId; name: string; attributeType: AttributeType }
  | { type: 'removeAttribute'; id: InstanceId; name: string }
  | { type: 'addClassProperty'; className: string; property: PropertySchema; parentPath?: string }
  | { type: 'addClassProperties'; className: string; properties: PropertySchema[]; parentPath?: string }
  | { type: 'updateClassProperty'; className: string; propertyName: string; property: PropertySchema }
  | { type: 'removeClassProperty'; className: string; propertyName: string }
  | { type: 'duplicateClassProperty'; className: string; propertyName: string }
  | {
      type: 'moveClassProperty'
      className: string
      propertyName: string
      parentPath: string | null
      before?: string | null
      category?: string
    }
  | { type: 'restoreClassProperties'; className: string }
  | { type: 'dismissNotice'; noticeId: number }
  | { type: 'reset' }

function notify(state: DataModelState, kind: NoticeKind, message: string): DataModelState {
  const notice = { id: state.nextNoticeId, kind, message }
  return { ...state, notices: [...state.notices, notice].slice(-4), nextNoticeId: state.nextNoticeId + 1 }
}

const reject = (state: DataModelState, message: string) => notify(state, 'error', message)

function updateNode(state: DataModelState, id: InstanceId, update: (node: InstanceNode) => InstanceNode): DataModelState {
  const node = state.nodes[id]
  if (!node) return state
  return { ...state, nodes: { ...state.nodes, [id]: update(node) } }
}

/** Returns an error message if `id` cannot be moved under `parentId`, mirroring Instance::setParent checks. */
export function getReparentError(state: DataModelState, id: InstanceId, parentId: InstanceId): string | null {
  const node = state.nodes[id]
  const parent = state.nodes[parentId]
  if (!node || !parent) return 'That instance no longer exists.'
  if (node.parentId === null) return 'The DataModel is the root of the place and cannot be given a parent.'
  const schema = getClass(node.className)
  if (schema.protected || isService(node.className)) {
    return `The Parent property of ${node.name} is locked.`
  }
  if (id === parentId) return `Attempt to set ${node.name} as its own parent.`
  if (isDescendantOrSelf(state, parentId, id)) {
    return `Attempt to set parent of ${getFullName(state, id)} to ${getFullName(state, parentId)} would result in circular reference.`
  }
  if (parent.parentId === null && !isService(node.className)) return 'Only services can be placed directly under the DataModel.'
  if (schema.fixedParentClass && !isA(parent.className, schema.fixedParentClass)) {
    return `${node.className} must be parented to ${schema.fixedParentClass}.`
  }
  if (
    schema.singletonPerParent &&
    parent.children.some((childId) => childId !== id && state.nodes[childId]?.className === node.className)
  ) {
    return `${parent.name} can only contain one ${node.className}.`
  }
  return null
}

export function getDeleteError(state: DataModelState, id: InstanceId): string | null {
  const node = state.nodes[id]
  if (!node) return 'That instance no longer exists.'
  if (node.parentId === null) return 'The DataModel cannot be deleted.'
  if (isService(node.className) || getClass(node.className).protected) return `${node.name} is protected and cannot be deleted.`
  return null
}

export function getReferenceError(
  state: DataModelState,
  ownerId: InstanceId,
  propertyName: string,
  targetId: InstanceId | null,
): string | null {
  const owner = state.nodes[ownerId]
  if (!owner || targetId === null) return null
  const schema = getPropertySchema(owner.className, propertyName, state.classOverlays)
  const target = state.nodes[targetId]
  if (!schema) return `${propertyName} is not a property of ${owner.className}.`
  if (!target) return 'The referenced instance no longer exists.'
  if (schema.referenceClass && !isA(target.className, schema.referenceClass)) {
    return `${propertyName} must reference a ${schema.referenceClass}, but ${target.name} is a ${target.className}.`
  }
  if (schema.referenceMustBeDescendant && (targetId === ownerId || !isDescendantOrSelf(state, targetId, ownerId))) {
    return `${propertyName} must be a descendant of ${owner.name}.`
  }
  return null
}

/** Clears instance references that became invalid after a tree change. Returns a description of each one cleared. */
function sanitizeReferences(state: DataModelState): { state: DataModelState; cleared: string[] } {
  const cleared: string[] = []
  let next = state
  for (const node of Object.values(state.nodes)) {
    for (const { schema, key } of flattenPropertySchemas(getAllProperties(node.className, state.classOverlays))) {
      if (schema.type !== 'Instance' || (schema.storage ?? 'value') !== 'value') continue
      const current = node.properties[key]
      if (current?.type !== 'Instance' || current.value === null) continue
      const error = getReferenceError(next, node.id, key, current.value)
      if (error === null) continue
      cleared.push(`${node.name}.${key} (${error.replace(/\.$/, '')})`)
      next = updateNode(next, node.id, (n) => ({
        ...n,
        properties: { ...n.properties, [key]: { type: 'Instance', value: null } },
      }))
    }
  }
  return { state: next, cleared }
}

function withReferenceCleanup(state: DataModelState): DataModelState {
  const { state: next, cleared } = sanitizeReferences(state)
  if (cleared.length === 0) return next
  return notify(next, 'info', `Cleared ${cleared.join('; ')}.`)
}

function allocateId(state: DataModelState): [InstanceId, DataModelState] {
  return [`inst-${state.nextId}`, { ...state, nextId: state.nextId + 1 }]
}

function createInstance(state: DataModelState, className: string, parentId: InstanceId): DataModelState {
  const parent = state.nodes[parentId]
  if (!parent) return reject(state, 'Choose a parent before inserting an instance.')
  const schema = getClass(className)
  if (!schema.creatable) return reject(state, `${className} is not creatable.`)
  if (parent.parentId === null) return reject(state, 'Only services can be placed directly under the DataModel.')
  if (schema.fixedParentClass && !isA(parent.className, schema.fixedParentClass)) {
    return reject(state, `${className} must be parented to ${schema.fixedParentClass}.`)
  }
  if (schema.singletonPerParent && parent.children.some((id) => state.nodes[id]?.className === className)) {
    return reject(state, `${parent.name} can only contain one ${className}.`)
  }

  const [id, withId] = allocateId(state)
  const node: InstanceNode = {
    id,
    className,
    name: className,
    parentId,
    children: [],
    properties: getDefaultProperties(className, state.classOverlays),
    attributes: [],
  }
  return {
    ...withId,
    nodes: { ...withId.nodes, [id]: node, [parentId]: { ...parent, children: [...parent.children, id] } },
    expanded: { ...withId.expanded, [parentId]: true },
    selectedId: id,
  }
}

function duplicateInstance(state: DataModelState, id: InstanceId): DataModelState {
  const original = state.nodes[id]
  if (!original) return state
  const error = getDeleteError(state, id)
  if (error) return reject(state, error.replace('deleted', 'duplicated'))

  const subtree = [id, ...getDescendantIds(state, id)]
  const idMap = new Map<InstanceId, InstanceId>()
  let next = state
  for (const oldId of subtree) {
    const [newId, withId] = allocateId(next)
    idMap.set(oldId, newId)
    next = withId
  }

  const nodes = { ...next.nodes }
  for (const oldId of subtree) {
    const source = state.nodes[oldId]
    const properties: Record<string, Variant> = {}
    for (const [key, value] of Object.entries(source.properties)) {
      properties[key] =
        value.type === 'Instance' && value.value && idMap.has(value.value)
          ? { type: 'Instance', value: idMap.get(value.value)! }
          : structuredClone(value)
    }
    nodes[idMap.get(oldId)!] = {
      ...source,
      id: idMap.get(oldId)!,
      parentId: oldId === id ? source.parentId : idMap.get(source.parentId!)!,
      children: source.children.map((child) => idMap.get(child)!),
      properties,
      attributes: structuredClone(source.attributes),
    }
  }

  const parent = nodes[original.parentId!]
  const index = parent.children.indexOf(id)
  const children = [...parent.children]
  children.splice(index + 1, 0, idMap.get(id)!)
  nodes[parent.id] = { ...parent, children }
  return { ...next, nodes, selectedId: idMap.get(id)! }
}

function deleteInstance(state: DataModelState, id: InstanceId): DataModelState {
  const error = getDeleteError(state, id)
  if (error) return reject(state, error)
  const node = state.nodes[id]
  const removed = new Set([id, ...getDescendantIds(state, id)])
  const nodes = { ...state.nodes }
  for (const removedId of removed) delete nodes[removedId]
  const parent = nodes[node.parentId!]
  nodes[parent.id] = { ...parent, children: parent.children.filter((child) => child !== id) }

  const selectedId = state.selectedId && removed.has(state.selectedId) ? parent.id : state.selectedId
  const descendantCount = removed.size - 1
  const message =
    descendantCount > 0
      ? `Deleted ${node.name} and ${descendantCount} descendant${descendantCount === 1 ? '' : 's'}.`
      : `Deleted ${node.name}.`
  return withReferenceCleanup(notify({ ...state, nodes, selectedId }, 'info', message))
}

function renameInstance(state: DataModelState, id: InstanceId, name: string): DataModelState {
  if (!state.nodes[id]) return state
  if (getClass(state.nodes[id].className).protected) return reject(state, `${state.nodes[id].name} has a locked name.`)
  const truncated = name.slice(0, MAX_NAME_LENGTH)
  const next = updateNode(state, id, (node) => ({ ...node, name: truncated }))
  return truncated.length < name.length
    ? notify(next, 'info', `Names are limited to ${MAX_NAME_LENGTH} characters, so the name was truncated.`)
    : next
}

function reparentInstance(state: DataModelState, id: InstanceId, parentId: InstanceId): DataModelState {
  const node = state.nodes[id]
  if (node && node.parentId === parentId) return state
  const error = getReparentError(state, id, parentId)
  if (error) return reject(state, error)

  const oldParent = state.nodes[node.parentId!]
  const newParent = state.nodes[parentId]
  const nodes = {
    ...state.nodes,
    [oldParent.id]: { ...oldParent, children: oldParent.children.filter((child) => child !== id) },
    [newParent.id]: { ...newParent, children: [...newParent.children, id] },
    [id]: { ...node, parentId },
  }
  return withReferenceCleanup({ ...state, nodes, expanded: { ...state.expanded, [parentId]: true } })
}

const clamp = (value: number, min?: number, max?: number) =>
  Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, value))

function setProperty(state: DataModelState, id: InstanceId, property: string, value: Variant): DataModelState {
  const node = state.nodes[id]
  if (!node) return state
  const key = propertyKey(property)
  const schemas = getAllProperties(node.className, state.classOverlays)
  const schema = findPropertySchema(schemas, property)
  if (!schema || schema.hidden) return reject(state, `${key} is not a property of ${node.className}.`)
  if (schema.readOnly || schema.compute || isPropertyGated(node, schemas, property)) {
    return reject(state, `${key} is read-only.`)
  }
  const typeError = validateVariant(value, schema.type)
  if (typeError) return reject(state, `Invalid value for ${key}: ${typeError}`)

  const storage = schema.storage ?? 'value'
  if (storage === 'name' && value.type === 'string') return renameInstance(state, id, value.value)
  if (storage === 'parent' && value.type === 'Instance') {
    if (value.value === null) return reject(state, 'Parent cannot be cleared here. Delete the instance instead.')
    return reparentInstance(state, id, value.value)
  }

  let normalized = value
  if (value.type === 'number') {
    normalized = { type: 'number', value: clamp(value.value, schema.min, schema.max) }
  } else if (value.type === 'Vector3') {
    const { x, y, z } = value.value
    normalized = {
      type: 'Vector3',
      value: { x: clamp(x, schema.min, schema.max), y: clamp(y, schema.min, schema.max), z: clamp(z, schema.min, schema.max) },
    }
  } else if (value.type === 'enum' && !schema.enumValues?.includes(value.value)) {
    return reject(state, `${value.value} is not a valid ${key}.`)
  } else if (value.type === 'Instance') {
    const refError = getReferenceError(state, id, key, value.value)
    if (refError) return reject(state, refError)
  }

  return updateNode(state, id, (n) => ({ ...n, properties: { ...n.properties, [key]: normalized } }))
}

function resetProperty(state: DataModelState, id: InstanceId, property: string): DataModelState {
  const node = state.nodes[id]
  const schema = node && getPropertySchema(node.className, property, state.classOverlays)
  if (!node || !schema || (schema.storage ?? 'value') !== 'value') return state
  return setProperty(state, id, propertyKey(property), structuredClone(schema.defaultValue))
}

function addAttribute(state: DataModelState, id: InstanceId, name: string, attributeType: AttributeType): DataModelState {
  const node = state.nodes[id]
  if (!node) return state
  const error = validateAttributeName(name, node.attributes.map((a) => a.name))
  if (error) return reject(state, error)
  return updateNode(state, id, (n) => ({
    ...n,
    attributes: [...n.attributes, { name, value: defaultAttributeValue(attributeType) }],
  }))
}

function setAttribute(state: DataModelState, id: InstanceId, name: string, value: Variant): DataModelState {
  const attribute = state.nodes[id]?.attributes.find((a) => a.name === name)
  if (!attribute) return reject(state, `No attribute named ${name}.`)
  const error = validateVariant(value, attribute.value.type)
  if (error) return reject(state, `Invalid value for attribute ${name}: ${error}`)
  return updateNode(state, id, (n) => ({
    ...n,
    attributes: n.attributes.map((a) => (a.name === name ? { ...a, value } : a)),
  }))
}

function renameAttribute(state: DataModelState, id: InstanceId, name: string, newName: string): DataModelState {
  const node = state.nodes[id]
  if (!node || name === newName) return state
  const error = validateAttributeName(newName, node.attributes.map((a) => a.name), name)
  if (error) return reject(state, error)
  return updateNode(state, id, (n) => ({
    ...n,
    attributes: n.attributes.map((a) => (a.name === name ? { ...a, name: newName } : a)),
  }))
}

function setAttributeType(state: DataModelState, id: InstanceId, name: string, attributeType: AttributeType): DataModelState {
  return updateNode(state, id, (n) => ({
    ...n,
    attributes: n.attributes.map((a) =>
      a.name === name && a.value.type !== attributeType ? { ...a, value: defaultAttributeValue(attributeType) } : a,
    ),
  }))
}

const EMPTY_OVERLAY: ClassPropertyOverlay = { added: [], removed: [], overrides: {}, placements: {} }
const CORE_PROPERTIES = new Set(['ClassName', 'Name', 'Parent'])

function copyOverlay(state: DataModelState, className: string): ClassPropertyOverlay {
  const current = state.classOverlays[className] ?? EMPTY_OVERLAY
  return {
    added: structuredClone(current.added),
    removed: [...current.removed],
    overrides: structuredClone(current.overrides),
    placements: structuredClone(current.placements ?? {}),
  }
}

function reconcileClassProperties(state: DataModelState, changedClass: string): DataModelState {
  const nodes = { ...state.nodes }
  for (const node of Object.values(state.nodes)) {
    if (!isA(node.className, changedClass)) continue
    const properties: Record<string, Variant> = {}
    for (const { schema, key } of flattenPropertySchemas(getAllProperties(node.className, state.classOverlays))) {
      if ((schema.storage ?? 'value') !== 'value' || schema.compute) continue
      const current = node.properties[key]
      properties[key] =
        current?.type === schema.defaultValue.type ? structuredClone(current) : structuredClone(schema.defaultValue)
    }
    nodes[node.id] = { ...node, properties }
  }
  return { ...state, nodes }
}

function asPropertyNameError(error: string | null): string | null {
  return error?.replace('An attribute', 'A property').replaceAll('Attribute', 'Property').replaceAll('attribute', 'property') ?? null
}

function validatePropertyName(
  state: DataModelState,
  className: string,
  name: string,
  parentPath = '',
  currentName?: string,
): string | null {
  const schemas = getAllProperties(className, state.classOverlays)
  const siblings = getPropertySiblings(schemas, parentPath) ?? []
  const error = validateAttributeName(
    name,
    siblings.map((prop) => prop.name),
    currentName,
  )
  return asPropertyNameError(error)
}

function normalizeSchema(property: PropertySchema): PropertySchema {
  return {
    ...property,
    sourcePath: undefined,
    gatesChildren: property.type === 'bool' ? property.gatesChildren : undefined,
    children: property.children?.map(normalizeSchema),
  }
}

function canonicalSource(schema: PropertySchema, fallback: string): string {
  return schema.sourcePath ?? fallback
}

function migratePlacementMap(
  placements: Record<string, PropertyPlacement>,
  from: string,
  to: string,
): Record<string, PropertyPlacement> {
  if (from === to) return placements
  const next: Record<string, PropertyPlacement> = {}
  for (const [path, placement] of Object.entries(placements)) {
    next[isPathEqualOrDescendant(path, from) ? replacePathPrefix(path, from, to) : path] = {
      parent: placement.parent && isPathEqualOrDescendant(placement.parent, from) ? replacePathPrefix(placement.parent, from, to) : placement.parent,
      index: placement.index,
    }
  }
  return next
}

function getOwnCustomRootIndex(overlay: ClassPropertyOverlay, propertyPath: string): number {
  const [rootName] = normalizePropertyPath(propertyPath)
  return overlay.added.findIndex((property) => property.name === rootName)
}

function migratePropertyPrefix(
  state: DataModelState,
  className: string,
  oldPath: string,
  newPath: string,
): DataModelState {
  if (oldPath === newPath) return state
  const nodes = { ...state.nodes }
  for (const node of Object.values(state.nodes)) {
    if (!isA(node.className, className)) continue
    const properties = { ...node.properties }
    for (const [key, value] of Object.entries(node.properties)) {
      if (!isPathEqualOrDescendant(key, oldPath)) continue
      const suffix = normalizePropertyPath(key).slice(normalizePropertyPath(oldPath).length)
      properties[propertyKey([...normalizePropertyPath(newPath), ...suffix])] = value
      delete properties[key]
    }
    nodes[node.id] = { ...node, properties }
  }
  return { ...state, nodes }
}

export function getBulkPropertyError(
  state: DataModelState,
  className: string,
  properties: PropertySchema[],
  parentPath = '',
): string | null {
  const existing = (getPropertySiblings(getAllProperties(className, state.classOverlays), parentPath) ?? []).map(
    (property) => property.name,
  )
  return validateBulkLevel(properties, existing, parentPath)
}

function validateBulkLevel(properties: PropertySchema[], existingNames: string[], parentPath: string): string | null {
  const names = [...existingNames]
  for (const property of properties) {
    const nameError = asPropertyNameError(validateAttributeName(property.name, names))
    if (nameError) return nameError
    if (!parentPath && CORE_PROPERTIES.has(property.name)) return `${property.name} is required by the Explorer.`
    names.push(property.name)
    if (property.children?.length) {
      const childError = validateBulkLevel(property.children, [], propertyKey(appendPropertyPath(parentPath, property.name)))
      if (childError) return childError
    }
  }
  return null
}

function addClassProperties(
  state: DataModelState,
  className: string,
  properties: PropertySchema[],
  parentPath = '',
): DataModelState {
  const error = getBulkPropertyError(state, className, properties, parentPath)
  if (error) return reject(state, error)
  return properties.reduce((next, property) => addClassProperty(next, className, property, parentPath), state)
}

function addClassProperty(
  state: DataModelState,
  className: string,
  property: PropertySchema,
  parentPath = '',
): DataModelState {
  const error = validatePropertyName(state, className, property.name, parentPath)
  if (error) return reject(state, error)
  if (!parentPath && CORE_PROPERTIES.has(property.name)) return reject(state, `${property.name} is required by the Explorer.`)
  const parent = parentPath ? getPropertySchema(className, parentPath, state.classOverlays) : undefined
  if (parentPath && !parent) return reject(state, `${propertyLabel(parentPath)} is not on ${className}.`)
  const parentSource = parent ? canonicalSource(parent, parentPath) : ''
  const overlay = copyOverlay(state, className)
  const normalized = normalizeSchema(structuredClone(property))
  if (!parentSource) {
    overlay.added.push(normalized)
  } else {
    const ownRootIndex = getOwnCustomRootIndex(overlay, parentSource)
    if (ownRootIndex >= 0 && findPropertySchema([overlay.added[ownRootIndex]], parentSource)) {
      updatePropertySchema(overlay.added, parentSource, (current) => ({
        ...current,
        children: [...(current.children ?? []), normalized],
      }))
    } else {
      const canonicalParent = findPropertySchema(getCanonicalProperties(className, state.classOverlays), parentSource)
      overlay.overrides[parentSource] = {
        ...overlay.overrides[parentSource],
        children: [
          ...(canonicalParent?.children ?? []).map((child) => normalizeSchema(structuredClone(child))),
          normalized,
        ],
      }
    }
  }
  const addedSource = propertyKey(appendPropertyPath(parentSource, normalized.name))
  overlay.removed = overlay.removed.filter((path) => path !== addedSource)
  const next = {
    ...state,
    classOverlays: { ...state.classOverlays, [className]: overlay },
  }
  return reconcileClassProperties(next, className)
}

function updateClassProperty(
  state: DataModelState,
  className: string,
  propertyName: string,
  property: PropertySchema,
): DataModelState {
  const path = normalizePropertyPath(propertyName)
  const key = propertyKey(path)
  if (path.length === 1 && CORE_PROPERTIES.has(path[0])) return reject(state, `${path[0]} is required by the Explorer.`)
  const existing = getPropertySchema(className, path, state.classOverlays)
  if (!existing) return reject(state, `${key} is not on ${className}.`)
  const source = canonicalSource(existing, key)
  const overlay = copyOverlay(state, className)
  const owned = !isBuiltInProperty(className, source) ? findOwnedCustomProperty(overlay, source) : undefined
  let nextState = state
  if (owned) {
    const parentPath = propertyKey(path.slice(0, -1))
    const error = validatePropertyName(state, className, property.name, parentPath, existing.name)
    if (error) return reject(state, error)
    const normalized = normalizeSchema(structuredClone(property))
    normalized.children = owned.previous.children?.map((child) => normalizeSchema(structuredClone(child)))
    owned.replace(normalized)
    const nextSource = propertyKey([...normalizePropertyPath(source).slice(0, -1), normalized.name])
    const nextPath = propertyKey([...path.slice(0, -1), normalized.name])
    overlay.placements = migratePlacementMap(overlay.placements ?? {}, source, nextSource)
    overlay.overrides = Object.fromEntries(
      Object.entries(overlay.overrides).map(([overridePath, override]) => [
        isPathEqualOrDescendant(overridePath, source) ? replacePathPrefix(overridePath, source, nextSource) : overridePath,
        override,
      ]),
    )
    nextState = migratePropertyPrefix(state, className, key, nextPath)
  } else if (property.name !== existing.name) {
    const parentPath = propertyKey(path.slice(0, -1))
    const error = validatePropertyName(state, className, property.name, parentPath, existing.name)
    if (error) return reject(state, error)
    if (!parentPath && CORE_PROPERTIES.has(property.name)) return reject(state, `${property.name} is required by the Explorer.`)
    const normalized = applySchemaEdits(existing, property)
    const nextSource = propertyKey([...normalizePropertyPath(source).slice(0, -1), normalized.name])
    const nextPath = propertyKey([...path.slice(0, -1), normalized.name])
    const canonicalSiblings = parentPath
      ? (findPropertySchema(getCanonicalProperties(className, state.classOverlays), parentPath)?.children ?? [])
      : getCanonicalProperties(className, state.classOverlays)
    const canonicalIndex = canonicalSiblings.findIndex((item) => item.name === existing.name)
    for (const overridePath of Object.keys(overlay.overrides)) {
      if (isPathEqualOrDescendant(overridePath, source)) delete overlay.overrides[overridePath]
    }
    overlay.removed = overlay.removed.filter((removedPath) => !isPathEqualOrDescendant(removedPath, source))
    overlay.removed.push(source)
    attachProperty(overlay, { ...state, classOverlays: { ...state.classOverlays, [className]: overlay } }, className, normalized, parentPath)
    const previousPlacement = overlay.placements?.[source]
    overlay.placements = migratePlacementMap(overlay.placements ?? {}, source, nextSource)
    if (!previousPlacement) overlay.placements[nextSource] = { parent: parentPath || null, index: Math.max(canonicalIndex, 0) }
    nextState = migratePropertyPrefix(state, className, key, nextPath)
  } else {
    const typeChanged = property.type !== existing.type
    const override: Partial<PropertySchema> = {
      ...overlay.overrides[source],
      category: property.category,
      description: property.description,
      readOnly: property.readOnly,
      type: property.type,
      defaultValue: structuredClone(property.defaultValue),
      enumValues: property.type === 'enum' ? property.enumValues : undefined,
      min: property.min,
      max: property.max,
      step: property.step,
      gatesChildren: property.type === 'bool' ? property.gatesChildren : undefined,
    }
    if (typeChanged) override.compute = undefined
    overlay.overrides[source] = override
  }
  const next = { ...nextState, classOverlays: { ...nextState.classOverlays, [className]: overlay } }
  return reconcileClassProperties(next, className)
}

function removeClassProperty(state: DataModelState, className: string, propertyName: string): DataModelState {
  const path = normalizePropertyPath(propertyName)
  const key = propertyKey(path)
  if (path.length === 1 && CORE_PROPERTIES.has(path[0])) return reject(state, `${path[0]} is required by the Explorer.`)
  const existing = getPropertySchema(className, path, state.classOverlays)
  if (!existing) return state
  const source = canonicalSource(existing, key)
  const overlay = copyOverlay(state, className)
  const ownRootIndex = getOwnCustomRootIndex(overlay, source)
  const ownCustom = ownRootIndex >= 0 && Boolean(findPropertySchema([overlay.added[ownRootIndex]], source))
  if (ownCustom) removePropertySchema(overlay.added, source)
  for (const overridePath of Object.keys(overlay.overrides)) {
    if (isPathEqualOrDescendant(overridePath, source)) delete overlay.overrides[overridePath]
  }
  overlay.removed = overlay.removed.filter((removedPath) => !isPathEqualOrDescendant(removedPath, source))
  if (!ownCustom) overlay.removed.push(source)
  overlay.placements = Object.fromEntries(
    Object.entries(overlay.placements ?? {}).filter(
      ([placementPath, placement]) =>
        !isPathEqualOrDescendant(placementPath, source) &&
        !(placement.parent && isPathEqualOrDescendant(placement.parent, source)),
    ),
  )
  const next = { ...state, classOverlays: { ...state.classOverlays, [className]: overlay } }
  return reconcileClassProperties(next, className)
}

function cloneEditableSchema(schema: PropertySchema): PropertySchema {
  return {
    ...schema,
    sourcePath: undefined,
    defaultValue: structuredClone(schema.defaultValue),
    enumValues: schema.enumValues ? [...schema.enumValues] : undefined,
    children: schema.children?.map(cloneEditableSchema),
  }
}

function applySchemaEdits(existing: PropertySchema, edits: PropertySchema): PropertySchema {
  return {
    ...cloneEditableSchema(existing),
    name: edits.name,
    category: edits.category,
    type: edits.type,
    description: edits.description,
    readOnly: edits.readOnly,
    enumValues: edits.type === 'enum' ? edits.enumValues : undefined,
    min: edits.min,
    max: edits.max,
    step: edits.step,
    gatesChildren: edits.type === 'bool' ? edits.gatesChildren : undefined,
    defaultValue: structuredClone(edits.defaultValue),
    compute: edits.type === existing.type ? existing.compute : undefined,
  }
}

function attachProperty(
  overlay: ClassPropertyOverlay,
  state: DataModelState,
  className: string,
  property: PropertySchema,
  parentPath: string,
) {
  const parent = parentPath ? getPropertySchema(className, parentPath, state.classOverlays) : undefined
  const parentSource = parent && parentPath ? canonicalSource(parent, parentPath) : ''
  if (!parentSource) {
    overlay.added.push(property)
    return
  }
  const ownRootIndex = getOwnCustomRootIndex(overlay, parentSource)
  if (ownRootIndex >= 0 && findPropertySchema([overlay.added[ownRootIndex]], parentSource)) {
    updatePropertySchema(overlay.added, parentSource, (current) => ({
      ...current,
      children: [...(current.children ?? []), property],
    }))
    return
  }
  const canonicalParent = findPropertySchema(getCanonicalProperties(className, state.classOverlays), parentSource)
  const existingChildren = overlay.overrides[parentSource]?.children
  overlay.overrides[parentSource] = {
    ...overlay.overrides[parentSource],
    children: [
      ...(existingChildren ?? canonicalParent?.children ?? []).map((child) => normalizeSchema(structuredClone(child))),
      property,
    ],
  }
}

function findOwnedCustomProperty(
  overlay: ClassPropertyOverlay,
  source: string,
): { previous: PropertySchema; replace: (next: PropertySchema) => void } | undefined {
  const added = findPropertySchema(overlay.added, source)
  if (added) return { previous: added, replace: (next) => updatePropertySchema(overlay.added, source, () => next) }
  for (const [parentPath, override] of Object.entries(overlay.overrides)) {
    if (!override.children?.length || source === parentPath || !source.startsWith(`${parentPath}.`)) continue
    const relative = source.slice(parentPath.length + 1)
    const previous = findPropertySchema(override.children, relative)
    if (!previous) continue
    return { previous, replace: (next) => updatePropertySchema(override.children ?? [], relative, () => next) }
  }
  return undefined
}

function setPropertyCategory(overlay: ClassPropertyOverlay, source: string, category: string) {
  const ownRootIndex = getOwnCustomRootIndex(overlay, source)
  if (ownRootIndex >= 0 && findPropertySchema([overlay.added[ownRootIndex]], source)) {
    updatePropertySchema(overlay.added, source, (schema) => ({ ...schema, category }))
    return
  }
  overlay.overrides[source] = { ...overlay.overrides[source], category }
}

function moveClassProperty(
  state: DataModelState,
  className: string,
  propertyName: string,
  parentPath: string | null,
  before?: string | null,
  category?: string,
): DataModelState {
  const properties = getAllProperties(className, state.classOverlays)
  const from = propertyKey(propertyName)
  const fromSchema = findPropertySchema(properties, from)
  if (!fromSchema) return reject(state, `${from} is not on ${className}.`)
  const source = canonicalSource(fromSchema, from)
  if (normalizePropertyPath(from).length === 1 && CORE_PROPERTIES.has(fromSchema.name)) {
    return reject(state, `${fromSchema.name} stays at the top of the Properties panel.`)
  }
  if (parentPath && normalizePropertyPath(parentPath).length === 1 && CORE_PROPERTIES.has(parentPath)) {
    return reject(state, `${parentPath} cannot contain subproperties.`)
  }
  if (parentPath && (parentPath === from || isPathEqualOrDescendant(parentPath, from))) {
    return reject(state, 'A property cannot be moved inside itself.')
  }
  const parentSchema = parentPath ? findPropertySchema(properties, parentPath) : undefined
  if (parentPath && !parentSchema) return reject(state, `${propertyLabel(parentPath)} is not on ${className}.`)
  const parentSource = parentSchema && parentPath ? canonicalSource(parentSchema, parentPath) : null
  const siblingPath = (schema: PropertySchema) => (parentPath ? `${parentPath}.${schema.name}` : schema.name)
  const siblings = (parentSchema ? (parentSchema.children ?? []) : properties).filter(
    (schema) => schema.sourcePath !== source && !(parentSource === null && CORE_PROPERTIES.has(schema.name)),
  )
  if (siblings.some((schema) => schema.name === fromSchema.name)) {
    return reject(state, `${fromSchema.name} already exists there.`)
  }

  let insertAt = siblings.length
  if (before && parentSource === null && CORE_PROPERTIES.has(before)) insertAt = 0
  else if (before) {
    const index = siblings.findIndex((schema) => siblingPath(schema) === before)
    if (index < 0) return reject(state, `${propertyLabel(before)} is not in the destination.`)
    insertAt = index
  } else if (parentSource === null && category) {
    let last = -1
    siblings.forEach((schema, index) => {
      if (schema.category === category) last = index
    })
    insertAt = last + 1
  }
  const ordered = [...siblings]
  ordered.splice(insertAt, 0, fromSchema)
  const newPath = parentPath ? `${parentPath}.${fromSchema.name}` : fromSchema.name
  const next = newPath === from ? state : migratePropertyPrefix(state, className, from, newPath)
  const overlay = copyOverlay(next, className)
  const placements = { ...(overlay.placements ?? {}) }
  ordered.forEach((schema, index) => {
    if (!schema.sourcePath) return
    placements[schema.sourcePath] = { parent: parentSource, index }
  })
  overlay.placements = placements
  if (parentSource === null) {
    const destinationCategory = category ?? (before ? siblings.find((schema) => siblingPath(schema) === before)?.category : undefined)
    if (destinationCategory) setPropertyCategory(overlay, source, destinationCategory)
  }
  return reconcileClassProperties(
    { ...next, classOverlays: { ...next.classOverlays, [className]: overlay } },
    className,
  )
}

function nextDuplicateName(name: string, siblingNames: string[]): string {
  const taken = new Set(siblingNames)
  const match = /^(.*?)(\d+)$/.exec(name)
  const stem = match && match[1] ? match[1] : name
  let n = match && match[1] ? Number(match[2]) + 1 : 2
  let candidate = `${stem}${n}`
  while (taken.has(candidate)) {
    n += 1
    candidate = `${stem}${n}`
  }
  return candidate.slice(0, MAX_NAME_LENGTH)
}

function asDuplicateSchema(schema: PropertySchema, name: string): PropertySchema {
  const copy = cloneEditableSchema(schema)
  const strip = (property: PropertySchema): PropertySchema => {
    const next = { ...property, storage: undefined, compute: undefined }
    next.children = property.children?.map(strip)
    return next
  }
  return { ...strip(copy), name }
}

function copyPropertyValues(
  state: DataModelState,
  className: string,
  source: PropertySchema,
  fromPath: string,
  toPath: string,
): DataModelState {
  const entries = flattenPropertySchemas([source], normalizePropertyPath(fromPath).slice(0, -1))
  const nodes = { ...state.nodes }
  for (const node of Object.values(state.nodes)) {
    if (!isA(node.className, className)) continue
    const properties = { ...node.properties }
    for (const entry of entries) {
      const suffix = entry.key === fromPath ? '' : entry.key.slice(fromPath.length)
      properties[`${toPath}${suffix}`] = structuredClone(getPropertyValue(node, entry.schema, entry.key))
    }
    nodes[node.id] = { ...node, properties }
  }
  return { ...state, nodes }
}

function duplicateClassProperty(state: DataModelState, className: string, propertyName: string): DataModelState {
  const path = normalizePropertyPath(propertyName)
  const key = propertyKey(path)
  if (path.length === 1 && CORE_PROPERTIES.has(path[0])) return reject(state, `${path[0]} stays unique in the Properties panel.`)
  const existing = getPropertySchema(className, path, state.classOverlays)
  if (!existing) return reject(state, `${key} is not on ${className}.`)
  const parentPath = propertyKey(path.slice(0, -1))
  const properties = getAllProperties(className, state.classOverlays)
  const siblings = parentPath ? (findPropertySchema(properties, parentPath)?.children ?? []) : properties
  const index = siblings.findIndex((schema) => schema.name === existing.name)
  const name = nextDuplicateName(existing.name, siblings.map((schema) => schema.name))
  const error = validatePropertyName(state, className, name, parentPath)
  if (error) return reject(state, error)
  const copy = asDuplicateSchema(existing, name)
  let next = addClassProperty(state, className, copy, parentPath)
  const newPath = parentPath ? `${parentPath}.${name}` : name
  const following = siblings[index + 1]
  if (following && !(parentPath === '' && CORE_PROPERTIES.has(following.name))) {
    const before = parentPath ? `${parentPath}.${following.name}` : following.name
    next = moveClassProperty(next, className, newPath, parentPath || null, before, existing.category)
  } else if (!parentPath) {
    next = moveClassProperty(next, className, newPath, null, null, existing.category)
  }
  return copyPropertyValues(next, className, existing, key, newPath)
}

function restoreClassProperties(state: DataModelState, className: string): DataModelState {
  if (!state.classOverlays[className]) return state
  const classOverlays = { ...state.classOverlays }
  delete classOverlays[className]
  return reconcileClassProperties({ ...state, classOverlays }, className)
}

export function dataModelReducer(state: DataModelState, action: DataModelAction): DataModelState {
  switch (action.type) {
    case 'select':
      return { ...state, selectedId: action.id }
    case 'toggleExpanded':
      return { ...state, expanded: { ...state.expanded, [action.id]: !state.expanded[action.id] } }
    case 'setExpanded':
      return { ...state, expanded: { ...state.expanded, [action.id]: action.expanded } }
    case 'createInstance':
      return createInstance(state, action.className, action.parentId)
    case 'duplicateInstance':
      return duplicateInstance(state, action.id)
    case 'deleteInstance':
      return deleteInstance(state, action.id)
    case 'renameInstance':
      return renameInstance(state, action.id, action.name)
    case 'reparentInstance':
      return reparentInstance(state, action.id, action.parentId)
    case 'setProperty':
      return setProperty(state, action.id, action.property, action.value)
    case 'resetProperty':
      return resetProperty(state, action.id, action.property)
    case 'addAttribute':
      return addAttribute(state, action.id, action.name, action.attributeType)
    case 'setAttribute':
      return setAttribute(state, action.id, action.name, action.value)
    case 'renameAttribute':
      return renameAttribute(state, action.id, action.name, action.newName)
    case 'setAttributeType':
      return setAttributeType(state, action.id, action.name, action.attributeType)
    case 'removeAttribute':
      return updateNode(state, action.id, (n) => ({ ...n, attributes: n.attributes.filter((a) => a.name !== action.name) }))
    case 'addClassProperty':
      return addClassProperty(state, action.className, action.property, action.parentPath)
    case 'addClassProperties':
      return addClassProperties(state, action.className, action.properties, action.parentPath)
    case 'updateClassProperty':
      return updateClassProperty(state, action.className, action.propertyName, action.property)
    case 'removeClassProperty':
      return removeClassProperty(state, action.className, action.propertyName)
    case 'duplicateClassProperty':
      return duplicateClassProperty(state, action.className, action.propertyName)
    case 'moveClassProperty':
      return moveClassProperty(state, action.className, action.propertyName, action.parentPath, action.before, action.category)
    case 'restoreClassProperties':
      return restoreClassProperties(state, action.className)
    case 'dismissNotice':
      return { ...state, notices: state.notices.filter((notice) => notice.id !== action.noticeId) }
    case 'reset':
      return createSeedState()
  }
}
