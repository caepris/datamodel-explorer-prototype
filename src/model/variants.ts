import type { AttributeType, Color3, Variant, VariantType } from './types'

export const ATTRIBUTE_TYPES: AttributeType[] = ['string', 'bool', 'number', 'Vector3', 'Color3']

export const ATTRIBUTE_TYPE_LABELS: Record<AttributeType, string> = {
  string: 'string',
  bool: 'boolean',
  number: 'number',
  Vector3: 'Vector3',
  Color3: 'Color3',
}

export const MAX_NAME_LENGTH = 100

export function defaultAttributeValue(type: AttributeType): Variant {
  switch (type) {
    case 'string':
      return { type, value: '' }
    case 'bool':
      return { type, value: false }
    case 'number':
      return { type, value: 0 }
    case 'Vector3':
      return { type, value: { x: 0, y: 0, z: 0 } }
    case 'Color3':
      return { type, value: { r: 1, g: 1, b: 1 } }
  }
}

/** Mirrors the engine's attribute naming rules. Returns an error message or null. */
export function validateAttributeName(name: string, existingNames: string[], currentName?: string): string | null {
  if (name.length === 0) return 'Attribute name cannot be empty.'
  if (name.length > MAX_NAME_LENGTH) return `Attribute names are limited to ${MAX_NAME_LENGTH} characters.`
  if (!/^[A-Za-z0-9_]+$/.test(name)) return 'Attribute names may only contain letters, digits, and underscores.'
  if (name.startsWith('RBX')) return 'Attribute names starting with "RBX" are reserved for Roblox.'
  if (name !== currentName && existingNames.includes(name)) return `An attribute named "${name}" already exists.`
  return null
}

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

function isVector3(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return isFiniteNumber(v.x) && isFiniteNumber(v.y) && isFiniteNumber(v.z)
}

function isVector2(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return isFiniteNumber(v.x) && isFiniteNumber(v.y)
}

export function defaultVariant(type: VariantType, enumValues: string[] = []): Variant {
  switch (type) {
    case 'string':
      return { type, value: '' }
    case 'bool':
      return { type, value: false }
    case 'number':
      return { type, value: 0 }
    case 'enum':
      return { type, value: enumValues[0] ?? 'Default' }
    case 'Vector2':
      return { type, value: { x: 0, y: 0 } }
    case 'Vector3':
      return { type, value: { x: 0, y: 0, z: 0 } }
    case 'CFrame':
      return { type, value: { position: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0 } } }
    case 'Color3':
      return { type, value: { r: 1, g: 1, b: 1 } }
    case 'Instance':
      return { type, value: null }
  }
}

/** Returns an error message if the variant's payload doesn't match its declared type. */
export function validateVariant(variant: Variant, expectedType: VariantType): string | null {
  if (variant.type !== expectedType) return `Expected a ${expectedType} value but got ${variant.type}.`
  switch (variant.type) {
    case 'string':
    case 'enum':
      return typeof variant.value === 'string' ? null : 'Expected text.'
    case 'bool':
      return typeof variant.value === 'boolean' ? null : 'Expected true or false.'
    case 'number':
      return isFiniteNumber(variant.value) ? null : 'Expected a finite number.'
    case 'Vector2':
      return isVector2(variant.value) ? null : 'Each Vector2 component must be a finite number.'
    case 'Vector3':
      return isVector3(variant.value) ? null : 'Each Vector3 component must be a finite number.'
    case 'CFrame':
      return isVector3(variant.value.position) && isVector3(variant.value.orientation)
        ? null
        : 'Each CFrame component must be a finite number.'
    case 'Color3': {
      const { r, g, b } = variant.value
      return [r, g, b].every((c) => isFiniteNumber(c) && c >= 0 && c <= 1)
        ? null
        : 'Color3 components must be between 0 and 1.'
    }
    case 'Instance':
      return variant.value === null || typeof variant.value === 'string' ? null : 'Expected an instance reference.'
  }
}

export function variantsEqual(a: Variant, b: Variant): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

const toHexByte = (c: number) =>
  Math.round(Math.min(1, Math.max(0, c)) * 255)
    .toString(16)
    .padStart(2, '0')

export function color3ToHex({ r, g, b }: Color3): string {
  return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`
}

export function hexToColor3(hex: string): Color3 {
  const clean = hex.replace('#', '')
  return {
    r: parseInt(clean.slice(0, 2), 16) / 255,
    g: parseInt(clean.slice(2, 4), 16) / 255,
    b: parseInt(clean.slice(4, 6), 16) / 255,
  }
}

export function formatColor3({ r, g, b }: Color3): string {
  return `[${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}]`
}

export function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 1000) / 1000)
}

const formatVector = ({ x, y, z }: { x: number; y: number; z: number }) =>
  `${formatNumber(x)}, ${formatNumber(y)}, ${formatNumber(z)}`

export function formatVariant(value: Variant, resolveName: (id: string) => string): string {
  switch (value.type) {
    case 'string':
    case 'enum':
      return value.value
    case 'bool':
      return value.value ? 'true' : 'false'
    case 'number':
      return formatNumber(value.value)
    case 'Vector2':
      return `${formatNumber(value.value.x)}, ${formatNumber(value.value.y)}`
    case 'Vector3':
      return formatVector(value.value)
    case 'CFrame':
      return `${formatVector(value.value.position)} · ${formatVector(value.value.orientation)}`
    case 'Color3':
      return formatColor3(value.value)
    case 'Instance':
      return value.value ? resolveName(value.value) : 'None'
  }
}
