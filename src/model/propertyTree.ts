import type { InstanceNode, PropertySchema } from './types'

export type PropertyPath = readonly string[]
export type PropertyPathInput = string | PropertyPath

export interface PropertyEntry {
  schema: PropertySchema
  path: string[]
  key: string
  depth: number
}

export function normalizePropertyPath(path: PropertyPathInput): string[] {
  return typeof path === 'string' ? path.split('.').filter(Boolean) : [...path]
}

export function propertyKey(path: PropertyPathInput): string {
  return normalizePropertyPath(path).join('.')
}

export function propertyLabel(path: PropertyPathInput): string {
  return normalizePropertyPath(path).join('.')
}

export function appendPropertyPath(path: PropertyPathInput, name: string): string[] {
  return [...normalizePropertyPath(path), name]
}

export function flattenPropertySchemas(schemas: PropertySchema[], parentPath: PropertyPath = []): PropertyEntry[] {
  return schemas.flatMap((schema) => {
    const path = appendPropertyPath(parentPath, schema.name)
    return [
      { schema, path, key: propertyKey(path), depth: path.length - 1 },
      ...flattenPropertySchemas(schema.children ?? [], path),
    ]
  })
}

export function findPropertySchema(schemas: PropertySchema[], path: PropertyPathInput): PropertySchema | undefined {
  const parts = normalizePropertyPath(path)
  let siblings = schemas
  let current: PropertySchema | undefined
  for (const part of parts) {
    current = siblings.find((schema) => schema.name === part)
    if (!current) return undefined
    siblings = current.children ?? []
  }
  return current
}

export function getPropertySiblings(schemas: PropertySchema[], parentPath: PropertyPathInput): PropertySchema[] | undefined {
  const parts = normalizePropertyPath(parentPath)
  if (parts.length === 0) return schemas
  return findPropertySchema(schemas, parts)?.children
}

export function updatePropertySchema(
  schemas: PropertySchema[],
  path: PropertyPathInput,
  update: (schema: PropertySchema) => PropertySchema,
): boolean {
  const parts = normalizePropertyPath(path)
  const [name, ...rest] = parts
  const index = schemas.findIndex((schema) => schema.name === name)
  if (index < 0) return false
  if (rest.length === 0) {
    schemas[index] = update(schemas[index])
    return true
  }
  return updatePropertySchema(schemas[index].children ?? [], rest, update)
}

export function removePropertySchema(schemas: PropertySchema[], path: PropertyPathInput): boolean {
  const parts = normalizePropertyPath(path)
  const [name, ...rest] = parts
  const index = schemas.findIndex((schema) => schema.name === name)
  if (index < 0) return false
  if (rest.length === 0) {
    schemas.splice(index, 1)
    return true
  }
  return removePropertySchema(schemas[index].children ?? [], rest)
}

export function replacePathPrefix(path: PropertyPathInput, from: PropertyPathInput, to: PropertyPathInput): string {
  const suffix = normalizePropertyPath(path).slice(normalizePropertyPath(from).length)
  return propertyKey([...normalizePropertyPath(to), ...suffix])
}

const PINNED_ROOTS: Record<string, number> = { ClassName: -300, Name: -299, Parent: -298 }

export function arrangePropertyTree(
  schemas: PropertySchema[],
  placements: Record<string, { parent: string | null; index: number }> = {},
): PropertySchema[] {
  interface Node {
    source: string
    schema: PropertySchema
    canonicalParent: string | null
    canonicalIndex: number
    children: Node[]
  }

  const bySource = new Map<string, Node>()
  const visit = (list: PropertySchema[], parentSource: string | null, into: Node[]) => {
    list.forEach((schema, index) => {
      const source = parentSource ? `${parentSource}.${schema.name}` : schema.name
      const node: Node = {
        source,
        schema: { ...schema, sourcePath: source },
        canonicalParent: parentSource,
        canonicalIndex: index,
        children: [],
      }
      bySource.set(source, node)
      into.push(node)
      visit(schema.children ?? [], source, node.children)
    })
  }
  const canonicalRoots: Node[] = []
  visit(schemas, null, canonicalRoots)
  for (const node of bySource.values()) node.children = []

  const pinned = (node: Node) => node.canonicalParent === null && node.schema.name in PINNED_ROOTS
  const chosenParent = (node: Node) => {
    if (pinned(node)) return null
    const placement = placements[node.source]
    if (!placement || placement.parent === node.source) return node.canonicalParent
    if (placement.parent && !bySource.has(placement.parent)) return node.canonicalParent
    return placement.parent
  }
  const resolvedParent = (source: string): string | null => {
    const node = bySource.get(source)
    if (!node) return null
    const seen = new Set<string>([source])
    let parent = chosenParent(node)
    while (parent) {
      if (seen.has(parent)) return node.canonicalParent
      seen.add(parent)
      const parentNode = bySource.get(parent)
      if (!parentNode) return node.canonicalParent
      parent = chosenParent(parentNode)
    }
    return chosenParent(node)
  }
  const indexOf = (node: Node) =>
    pinned(node) ? PINNED_ROOTS[node.schema.name] : (placements[node.source]?.index ?? node.canonicalIndex)

  const roots: Node[] = []
  for (const node of bySource.values()) {
    const parent = resolvedParent(node.source)
    const parentNode = parent ? bySource.get(parent) : undefined
    if (parentNode) parentNode.children.push(node)
    else roots.push(node)
  }
  const emit = (nodes: Node[]): PropertySchema[] => {
    nodes.sort((a, b) => indexOf(a) - indexOf(b) || a.canonicalIndex - b.canonicalIndex || a.source.localeCompare(b.source))
    return nodes.map((node) => {
      const children = emit(node.children)
      return children.length > 0 ? { ...node.schema, children } : { ...node.schema, children: undefined }
    })
  }
  return emit(roots)
}

export function isPathEqualOrDescendant(candidate: PropertyPathInput, ancestor: PropertyPathInput): boolean {
  const candidateParts = normalizePropertyPath(candidate)
  const ancestorParts = normalizePropertyPath(ancestor)
  return (
    candidateParts.length >= ancestorParts.length &&
    ancestorParts.every((part, index) => candidateParts[index] === part)
  )
}

export function isPropertyGated(node: InstanceNode, schemas: PropertySchema[], path: PropertyPathInput): boolean {
  const parts = normalizePropertyPath(path)
  for (let length = 1; length < parts.length; length += 1) {
    const ancestorPath = parts.slice(0, length)
    const ancestor = findPropertySchema(schemas, ancestorPath)
    if (!ancestor?.gatesChildren || ancestor.type !== 'bool') continue
    const value = node.properties[propertyKey(ancestorPath)] ?? ancestor.defaultValue
    if (value.type === 'bool' && !value.value) return true
  }
  return false
}
