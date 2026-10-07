import type { ClassPropertyOverlays, ClassSchema, InstanceNode, PropertyPlacement, PropertySchema, Variant } from './types'
import { EXTENDED_CLASS_LIST } from './extendedClassCatalog'
import {
  arrangePropertyTree,
  findPropertySchema,
  flattenPropertySchemas,
  normalizePropertyPath,
  propertyKey,
  removePropertySchema,
  updatePropertySchema,
  type PropertyPathInput,
} from './propertyTree'

const str = (value: string): Variant => ({ type: 'string', value })
const bool = (value: boolean): Variant => ({ type: 'bool', value })
const num = (value: number): Variant => ({ type: 'number', value })
const enumValue = (value: string): Variant => ({ type: 'enum', value })
const vec2 = (x: number, y: number): Variant => ({ type: 'Vector2', value: { x, y } })
const vec3 = (x: number, y: number, z: number): Variant => ({ type: 'Vector3', value: { x, y, z } })
const color3 = (r: number, g: number, b: number): Variant => ({ type: 'Color3', value: { r, g, b } })
const cframe = (x = 0, y = 0, z = 0): Variant => ({
  type: 'CFrame',
  value: { position: { x, y, z }, orientation: { x: 0, y: 0, z: 0 } },
})
const nullRef: Variant = { type: 'Instance', value: null }

export const CATEGORY_ORDER = [
  'Data',
  'Appearance',
  'Transform',
  'Pivot',
  'Behavior',
  'Collision',
  'Part',
  'Assembly',
  'Lighting',
  'Fog',
  'Physics',
  'Streaming',
  'Level of Detail',
  'Scripting',
  'Value',
]

const MATERIALS = ['Plastic', 'SmoothPlastic', 'Wood', 'Metal', 'Concrete', 'Brick', 'Grass', 'Glass', 'Neon', 'Fabric']

const PART_DENSITY = 0.7

const classList: ClassSchema[] = [
  {
    className: 'Instance',
    superClass: null,
    creatable: false,
    description: 'Abstract base class of every object in the DataModel.',
    glyph: 'I',
    glyphColor: '#8a8a8a',
    properties: [
      {
        name: 'ClassName',
        category: 'Data',
        type: 'string',
        storage: 'className',
        readOnly: true,
        defaultValue: str(''),
        description: 'The class this instance was created as. Fixed for its lifetime.',
      },
      {
        name: 'Name',
        category: 'Data',
        type: 'string',
        storage: 'name',
        defaultValue: str(''),
        description: 'Display name. Not required to be unique among siblings; truncated to 100 characters.',
      },
      {
        name: 'Parent',
        category: 'Data',
        type: 'Instance',
        storage: 'parent',
        defaultValue: nullRef,
        description: 'The single instance that owns this one in the tree.',
      },
      {
        name: 'Archivable',
        category: 'Behavior',
        type: 'bool',
        defaultValue: bool(true),
        description: 'Whether the instance is saved and cloned.',
      },
      {
        name: 'RobloxLocked',
        category: 'Behavior',
        type: 'bool',
        hidden: true,
        defaultValue: bool(false),
        description: 'Internal security flag; not public, so Studio never shows it.',
      },
    ],
  },
  {
    className: 'DataModel',
    superClass: 'Instance',
    creatable: false,
    description: 'Root of the place. Its direct children are services.',
    glyph: 'DM',
    glyphColor: '#5b8def',
    properties: [
      { name: 'PlaceId', category: 'Data', type: 'number', readOnly: true, defaultValue: num(0) },
      { name: 'GameId', category: 'Data', type: 'number', readOnly: true, defaultValue: num(0) },
    ],
  },
  {
    className: 'PVInstance',
    superClass: 'Instance',
    creatable: false,
    description: 'Abstract base for instances that have a position and pivot.',
    glyph: 'PV',
    glyphColor: '#8a8a8a',
    properties: [],
  },
  {
    className: 'Model',
    superClass: 'PVInstance',
    creatable: true,
    description: 'Groups parts so they can be moved and pivoted together.',
    glyph: 'M',
    glyphColor: '#d9a441',
    properties: [
      {
        name: 'PrimaryPart',
        category: 'Data',
        type: 'Instance',
        referenceClass: 'BasePart',
        referenceMustBeDescendant: true,
        defaultValue: nullRef,
        description: 'Must be a BasePart inside this model. Cleared if that part leaves the model.',
      },
      { name: 'WorldPivot', category: 'Pivot', type: 'CFrame', defaultValue: cframe() },
      {
        name: 'Scale',
        category: 'Transform',
        type: 'number',
        readOnly: true,
        defaultValue: num(1),
        description: 'Editor-only in Studio; changed through the scale tool, not typed in.',
      },
      {
        name: 'LevelOfDetail',
        category: 'Level of Detail',
        type: 'enum',
        enumValues: ['Automatic', 'StreamingMesh', 'Disabled'],
        defaultValue: enumValue('Automatic'),
      },
      {
        name: 'ModelStreamingMode',
        category: 'Streaming',
        type: 'enum',
        enumValues: ['Default', 'Atomic', 'Persistent', 'PersistentPerPlayer', 'Nonatomic'],
        defaultValue: enumValue('Default'),
      },
    ],
  },
  {
    className: 'Workspace',
    superClass: 'Model',
    creatable: false,
    isService: true,
    description: 'Service holding everything that exists in the 3D world.',
    glyph: 'W',
    glyphColor: '#4fb36b',
    properties: [
      { name: 'Gravity', category: 'Physics', type: 'number', min: 0, step: 0.1, defaultValue: num(196.2) },
      { name: 'FallenPartsDestroyHeight', category: 'Physics', type: 'number', defaultValue: num(-500) },
      { name: 'StreamingEnabled', category: 'Streaming', type: 'bool', defaultValue: bool(false) },
      {
        name: 'Terrain',
        category: 'Data',
        type: 'Instance',
        referenceClass: 'Terrain',
        readOnly: true,
        defaultValue: nullRef,
      },
    ],
  },
  {
    className: 'BasePart',
    superClass: 'PVInstance',
    creatable: false,
    description: 'Abstract base for physical parts.',
    glyph: 'BP',
    glyphColor: '#8a8a8a',
    properties: [
      { name: 'Color', category: 'Appearance', type: 'Color3', defaultValue: color3(0.64, 0.64, 0.64) },
      { name: 'Material', category: 'Appearance', type: 'enum', enumValues: MATERIALS, defaultValue: enumValue('Plastic') },
      { name: 'Transparency', category: 'Appearance', type: 'number', min: 0, max: 1, step: 0.05, defaultValue: num(0) },
      { name: 'Reflectance', category: 'Appearance', type: 'number', min: 0, max: 1, step: 0.05, defaultValue: num(0) },
      { name: 'CastShadow', category: 'Appearance', type: 'bool', defaultValue: bool(true) },
      { name: 'Size', category: 'Transform', type: 'Vector3', min: 0.001, defaultValue: vec3(4, 1, 2) },
      { name: 'CFrame', category: 'Transform', type: 'CFrame', defaultValue: cframe(0, 0.5, 0) },
      { name: 'Anchored', category: 'Behavior', type: 'bool', defaultValue: bool(false) },
      { name: 'Locked', category: 'Behavior', type: 'bool', defaultValue: bool(false) },
      { name: 'CanCollide', category: 'Collision', type: 'bool', defaultValue: bool(true) },
      { name: 'CanTouch', category: 'Collision', type: 'bool', defaultValue: bool(true) },
      { name: 'CanQuery', category: 'Collision', type: 'bool', defaultValue: bool(true) },
      { name: 'CollisionGroup', category: 'Collision', type: 'string', defaultValue: str('Default') },
      {
        name: 'AssemblyMass',
        category: 'Assembly',
        type: 'number',
        readOnly: true,
        defaultValue: num(0),
        compute: (node: InstanceNode) => {
          const size = node.properties.Size
          if (size?.type !== 'Vector3') return num(0)
          const { x, y, z } = size.value
          return num(Math.round(x * y * z * PART_DENSITY * 1000) / 1000)
        },
        description: 'Computed by the physics engine from size and density; never set directly.',
      },
      {
        name: 'size',
        category: 'Transform',
        type: 'Vector3',
        hidden: true,
        defaultValue: vec3(4, 1, 2),
        description: 'Deprecated lowercase alias; not public.',
      },
    ],
  },
  {
    className: 'Part',
    superClass: 'BasePart',
    creatable: true,
    description: 'Primitive physical part: block, ball, cylinder, or wedge.',
    glyph: 'P',
    glyphColor: '#c7c7c7',
    properties: [
      {
        name: 'Shape',
        category: 'Part',
        type: 'enum',
        enumValues: ['Block', 'Ball', 'Cylinder', 'Wedge', 'CornerWedge'],
        defaultValue: enumValue('Block'),
      },
    ],
  },
  {
    className: 'Folder',
    superClass: 'Instance',
    creatable: true,
    description: 'Organizes instances without any behavior of its own.',
    glyph: 'F',
    glyphColor: '#e0b552',
    properties: [],
  },
  {
    className: 'Lighting',
    superClass: 'Instance',
    creatable: false,
    isService: true,
    description: 'Service controlling global lighting, time of day, and fog.',
    glyph: 'L',
    glyphColor: '#f0d34a',
    properties: [
      { name: 'Ambient', category: 'Appearance', type: 'Color3', defaultValue: color3(0.27, 0.27, 0.27) },
      { name: 'Brightness', category: 'Appearance', type: 'number', min: 0, max: 10, step: 0.1, defaultValue: num(2) },
      { name: 'ClockTime', category: 'Lighting', type: 'number', min: 0, max: 24, step: 0.25, defaultValue: num(14) },
      { name: 'GlobalShadows', category: 'Lighting', type: 'bool', defaultValue: bool(true) },
      {
        name: 'Technology',
        category: 'Lighting',
        type: 'enum',
        enumValues: ['Voxel', 'ShadowMap', 'Future', 'Compatibility'],
        defaultValue: enumValue('ShadowMap'),
      },
      { name: 'FogColor', category: 'Fog', type: 'Color3', defaultValue: color3(0.75, 0.75, 0.75) },
      { name: 'FogEnd', category: 'Fog', type: 'number', min: 0, defaultValue: num(100000) },
    ],
  },
  {
    className: 'ReplicatedStorage',
    superClass: 'Instance',
    creatable: false,
    isService: true,
    description: 'Service whose contents replicate to both server and clients.',
    glyph: 'RS',
    glyphColor: '#c46bd6',
    properties: [],
  },
  {
    className: 'ServerScriptService',
    superClass: 'Instance',
    creatable: false,
    isService: true,
    description: 'Service for server-only scripts; never replicated to clients.',
    glyph: 'SS',
    glyphColor: '#5aa9d6',
    properties: [{ name: 'LoadStringEnabled', category: 'Behavior', type: 'bool', defaultValue: bool(false) }],
  },
  {
    className: 'LuaSourceContainer',
    superClass: 'Instance',
    creatable: false,
    description: 'Abstract base for anything that holds Luau source.',
    glyph: 'LS',
    glyphColor: '#8a8a8a',
    properties: [
      {
        name: 'Source',
        category: 'Scripting',
        type: 'string',
        multiline: true,
        defaultValue: str('print("Hello world!")\n'),
        description: 'Stored as data only. This prototype never executes it.',
      },
    ],
  },
  {
    className: 'BaseScript',
    superClass: 'LuaSourceContainer',
    creatable: false,
    description: 'Abstract base for runnable scripts.',
    glyph: 'BS',
    glyphColor: '#8a8a8a',
    properties: [
      { name: 'Enabled', category: 'Behavior', type: 'bool', defaultValue: bool(true) },
      {
        name: 'RunContext',
        category: 'Behavior',
        type: 'enum',
        enumValues: ['Legacy', 'Server', 'Client', 'Plugin'],
        defaultValue: enumValue('Legacy'),
      },
    ],
  },
  {
    className: 'Script',
    superClass: 'BaseScript',
    creatable: true,
    description: 'Runs Luau code (on the server by default).',
    glyph: 'S',
    glyphColor: '#6fbf73',
    properties: [],
  },
  {
    className: 'ModuleScript',
    superClass: 'LuaSourceContainer',
    creatable: true,
    description: 'Reusable Luau module loaded with require().',
    glyph: 'MS',
    glyphColor: '#9a7de0',
    properties: [],
  },
  {
    className: 'ValueBase',
    superClass: 'Instance',
    creatable: false,
    description: 'Abstract base for single-value container objects.',
    glyph: 'V',
    glyphColor: '#8a8a8a',
    properties: [],
  },
  {
    className: 'BoolValue',
    superClass: 'ValueBase',
    creatable: true,
    description: 'Holds a single boolean.',
    glyph: 'B',
    glyphColor: '#e07a5f',
    properties: [{ name: 'Value', category: 'Data', type: 'bool', defaultValue: bool(false) }],
  },
  {
    className: 'NumberValue',
    superClass: 'ValueBase',
    creatable: true,
    description: 'Holds a single number.',
    glyph: 'N',
    glyphColor: '#e07a5f',
    properties: [{ name: 'Value', category: 'Data', type: 'number', defaultValue: num(0) }],
  },
  {
    className: 'StringValue',
    superClass: 'ValueBase',
    creatable: true,
    description: 'Holds a single string.',
    glyph: 'Ab',
    glyphColor: '#e07a5f',
    properties: [{ name: 'Value', category: 'Data', type: 'string', defaultValue: str('') }],
  },
  {
    className: 'ObjectValue',
    superClass: 'ValueBase',
    creatable: true,
    description: 'Holds a reference to another instance.',
    glyph: 'O',
    glyphColor: '#e07a5f',
    properties: [{ name: 'Value', category: 'Data', type: 'Instance', defaultValue: nullRef }],
  },
]

const allClasses = [...classList, ...EXTENDED_CLASS_LIST]

export const CLASS_CATALOG: Record<string, ClassSchema> = Object.fromEntries(
  allClasses.map((schema) => [schema.className, schema]),
)

export function getClass(className: string): ClassSchema {
  const schema = CLASS_CATALOG[className]
  if (!schema) throw new Error(`Unknown class ${className}`)
  return schema
}

/** Class name followed by each ancestor class, most-derived first. */
export function getClassChain(className: string): string[] {
  const chain: string[] = []
  let current: string | null = className
  while (current) {
    chain.push(current)
    current = getClass(current).superClass
  }
  return chain
}

export function isA(className: string, baseClass: string): boolean {
  return getClassChain(className).includes(baseClass)
}

function cloneSchema(schema: PropertySchema): PropertySchema {
  return {
    ...schema,
    sourcePath: undefined,
    defaultValue: structuredClone(schema.defaultValue),
    children: schema.children?.map(cloneSchema),
  }
}

/** Properties in their canonical class order, before visual placement is applied. */
export function getCanonicalProperties(className: string, overlays: ClassPropertyOverlays = {}): PropertySchema[] {
  const chain = getClassChain(className).reverse()
  const properties: PropertySchema[] = []
  for (const cls of chain) {
    for (const prop of getClass(cls).properties) {
      const index = properties.findIndex((current) => current.name === prop.name)
      const cloned = cloneSchema(prop)
      if (index >= 0) properties[index] = cloned
      else properties.push(cloned)
    }
    const overlay = overlays[cls]
    if (!overlay) continue
    for (const [path, override] of Object.entries(overlay.overrides)) {
      updatePropertySchema(properties, path, (current) => ({
        ...current,
        ...override,
        name: current.name,
        compute: 'compute' in override ? override.compute : current.compute,
        defaultValue: override.defaultValue ? structuredClone(override.defaultValue) : current.defaultValue,
        children: override.children?.map(cloneSchema) ?? current.children,
      }))
    }
    for (const prop of overlay.added) {
      const index = properties.findIndex((current) => current.name === prop.name)
      const cloned = cloneSchema(prop)
      if (index >= 0) properties[index] = cloned
      else properties.push(cloned)
    }
    for (const path of overlay.removed) removePropertySchema(properties, path)
  }
  return properties
}

/** Every property a class has, including inherited ones, in its visual order. */
export function getAllProperties(className: string, overlays: ClassPropertyOverlays = {}): PropertySchema[] {
  const placements: Record<string, PropertyPlacement> = {}
  for (const cls of getClassChain(className).reverse()) Object.assign(placements, overlays[cls]?.placements)
  return arrangePropertyTree(getCanonicalProperties(className, overlays), placements)
}

export function getVisibleProperties(className: string, overlays: ClassPropertyOverlays = {}): PropertySchema[] {
  return getAllProperties(className, overlays).filter((prop) => !prop.hidden)
}

export function getPropertySchema(
  className: string,
  propertyPath: PropertyPathInput,
  overlays: ClassPropertyOverlays = {},
): PropertySchema | undefined {
  return findPropertySchema(getAllProperties(className, overlays), propertyPath)
}

export function getCreatableClasses(): ClassSchema[] {
  return allClasses.filter((schema) => schema.creatable)
}

export function isService(className: string): boolean {
  return Boolean(getClass(className).isService)
}

/** Default values for every stored ("value") property of a class. */
export function getDefaultProperties(className: string, overlays: ClassPropertyOverlays = {}): Record<string, Variant> {
  const props: Record<string, Variant> = {}
  for (const { schema, path } of flattenPropertySchemas(getAllProperties(className, overlays))) {
    if ((schema.storage ?? 'value') === 'value' && !schema.compute) {
      props[propertyKey(path)] = structuredClone(schema.defaultValue)
    }
  }
  return props
}

export function isBuiltInProperty(className: string, propertyPath: PropertyPathInput): boolean {
  return Boolean(getPropertySchema(className, propertyPath))
}

export function isCustomProperty(className: string, propertyPath: PropertyPathInput, overlays: ClassPropertyOverlays): boolean {
  const path = normalizePropertyPath(propertyPath)
  return getClassChain(className).some((cls) => {
    const root = overlays[cls]?.added.find((prop) => prop.name === path[0])
    return root ? Boolean(findPropertySchema([root], path)) : false
  })
}

/** True when this class's overlay stores the property, so its name and type can change. */
export function classOwnsCustomProperty(
  className: string,
  propertyPath: PropertyPathInput,
  overlays: ClassPropertyOverlays,
): boolean {
  const schema = getPropertySchema(className, propertyPath, overlays)
  if (!schema) return false
  const source = schema.sourcePath ?? propertyKey(propertyPath)
  if (isBuiltInProperty(className, source)) return false
  const overlay = overlays[className]
  if (!overlay) return false
  if (findPropertySchema(overlay.added, source)) return true
  return Object.entries(overlay.overrides).some(([parentPath, override]) => {
    if (!override.children?.length || source === parentPath || !source.startsWith(`${parentPath}.`)) return false
    return Boolean(findPropertySchema(override.children, source.slice(parentPath.length + 1)))
  })
}

export const catalogHelpers = { str, bool, num, enumValue, vec2, vec3, color3, cframe, nullRef }
