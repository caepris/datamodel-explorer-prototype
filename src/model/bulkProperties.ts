import type { PropertySchema, VariantType } from './types'
import { defaultVariant } from './variants'

const PROPERTY_TYPES = new Set<VariantType>([
  'string',
  'bool',
  'number',
  'enum',
  'Vector2',
  'Vector3',
  'CFrame',
  'Color3',
  'Instance',
])

interface ParsedLine {
  line: number
  depth: number
  name: string
  type: VariantType
  category?: string
  enumValues?: string[]
  readOnly: boolean
  gatesChildren: boolean
}

interface DraftNode extends ParsedLine {
  children: DraftNode[]
}

export function parseBulkProperties(text: string, fallbackCategory = 'Data'): { properties: PropertySchema[] } | { error: string } {
  const nodes: DraftNode[] = []
  const stack: DraftNode[] = []
  const lines = text.split(/\r?\n/)
  for (let index = 0; index < lines.length; index += 1) {
    const parsed = parseLine(lines[index], index + 1)
    if (!parsed) continue
    if ('error' in parsed) return parsed
    const node: DraftNode = { ...parsed, children: [] }
    if (node.depth === 0) {
      nodes.push(node)
      stack.length = 0
      stack.push(node)
      continue
    }
    while (stack.length > 0 && stack[stack.length - 1].depth >= node.depth) stack.pop()
    const parent = stack[stack.length - 1]
    if (!parent || parent.depth !== node.depth - 1) {
      return { error: `Line ${node.line}: indent this subproperty two spaces under its parent.` }
    }
    node.category = node.category ?? parent.category
    parent.children.push(node)
    stack.push(node)
  }
  if (nodes.length === 0) return { error: 'Add at least one property.' }
  return { properties: nodes.map((node) => toSchema(node, fallbackCategory)) }
}

function parseLine(raw: string, line: number): ParsedLine | { error: string } | null {
  if (!raw.trim() || raw.trim().startsWith('#')) return null
  const indent = raw.match(/^[ \t]*/)?.[0] ?? ''
  const indentWidth = indent.replaceAll('\t', '  ').length
  if (indentWidth % 2 !== 0) return { error: `Line ${line}: indent by two spaces per nesting level.` }
  let body = raw.trim()
  const equalsAt = body.indexOf('=')
  let enumValues: string[] | undefined
  if (equalsAt >= 0) {
    enumValues = body
      .slice(equalsAt + 1)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
    body = body.slice(0, equalsAt).trim()
  }
  const categoryAt = body.indexOf('@')
  let category: string | undefined
  if (categoryAt >= 0) {
    const categoryResult = stripFlags(body.slice(categoryAt + 1))
    category = categoryResult.text
    body = `${body.slice(0, categoryAt)} ${categoryResult.flags.join(' ')}`.trim()
    if (!category) return { error: `Line ${line}: add a category after @.` }
  }
  const flagged = stripFlags(body)
  const tokens = flagged.text.split(/\s+/).filter(Boolean)
  const name = tokens[0]
  const typeToken = tokens[1] ?? 'string'
  if (!name) return { error: `Line ${line}: property name is missing.` }
  if (tokens.length > 2) return { error: `Line ${line}: unexpected "${tokens.slice(2).join(' ')}".` }
  if (!PROPERTY_TYPES.has(typeToken as VariantType)) {
    return { error: `Line ${line}: unknown type "${typeToken}".` }
  }
  const type = typeToken as VariantType
  const gatesChildren = flagged.flags.includes('gates')
  if (gatesChildren && type !== 'bool') return { error: `Line ${line}: only a bool property can gate its subproperties.` }
  if (type === 'enum' && (!enumValues || enumValues.length === 0)) {
    return { error: `Line ${line}: list enum options after =.` }
  }
  if (type !== 'enum' && enumValues) return { error: `Line ${line}: only enum properties can list options.` }
  return {
    line,
    depth: indentWidth / 2,
    name,
    type,
    category,
    enumValues,
    readOnly: flagged.flags.includes('readonly'),
    gatesChildren,
  }
}

function stripFlags(text: string): { text: string; flags: string[] } {
  const flags: string[] = []
  let rest = text.trim()
  for (;;) {
    const match = rest.match(/^(.*?)(?:\s+)(gates|readonly)$/i)
    if (!match) break
    flags.unshift(match[2].toLowerCase())
    rest = match[1].trim()
  }
  return { text: rest, flags }
}

function toSchema(node: DraftNode, fallbackCategory: string): PropertySchema {
  const category = node.category || fallbackCategory
  return {
    name: node.name,
    category,
    type: node.type,
    defaultValue: defaultVariant(node.type, node.enumValues),
    enumValues: node.enumValues,
    readOnly: node.readOnly || undefined,
    gatesChildren: node.gatesChildren || undefined,
    children: node.children.length > 0 ? node.children.map((child) => toSchema(child, category)) : undefined,
  }
}
