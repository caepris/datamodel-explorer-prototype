export type InstanceId = string

export interface Vector3 {
  x: number
  y: number
  z: number
}

export interface Vector2 {
  x: number
  y: number
}

export interface Color3 {
  r: number
  g: number
  b: number
}

export interface CFrame {
  position: Vector3
  orientation: Vector3
}

export type Variant =
  | { type: 'string'; value: string }
  | { type: 'bool'; value: boolean }
  | { type: 'number'; value: number }
  | { type: 'enum'; value: string }
  | { type: 'Vector2'; value: Vector2 }
  | { type: 'Vector3'; value: Vector3 }
  | { type: 'CFrame'; value: CFrame }
  | { type: 'Color3'; value: Color3 }
  | { type: 'Instance'; value: InstanceId | null }

export type VariantType = Variant['type']

export type AttributeType = 'string' | 'bool' | 'number' | 'Vector3' | 'Color3'

export interface Attribute {
  name: string
  value: Variant
}

export interface InstanceNode {
  id: InstanceId
  className: string
  name: string
  parentId: InstanceId | null
  children: InstanceId[]
  properties: Record<string, Variant>
  attributes: Attribute[]
}

/**
 * Where a property's value lives. Name, Parent and ClassName are reflected
 * properties in the engine but are stored on the node itself here.
 */
export type PropertyStorage = 'value' | 'name' | 'parent' | 'className'

export interface PropertySchema {
  name: string
  category: string
  type: VariantType
  defaultValue: Variant
  /** Nested prototype-only properties shown directly beneath this property. */
  children?: PropertySchema[]
  /** When this boolean is false, every descendant property is disabled. */
  gatesChildren?: boolean
  storage?: PropertyStorage
  readOnly?: boolean
  /** Not public in the reflection system, so the Properties panel never shows it. */
  hidden?: boolean
  multiline?: boolean
  enumValues?: string[]
  min?: number
  max?: number
  step?: number
  /** Instance references must point at an instance that isA this class. */
  referenceClass?: string
  /** Instance references must point at a descendant of the owning instance. */
  referenceMustBeDescendant?: boolean
  /** Read-only value derived from other state, e.g. AssemblyMass from Size. */
  compute?: (node: InstanceNode) => Variant
  description?: string
  /** Canonical path before a class overlay rearranges the property tree. */
  sourcePath?: string
}

/** Visual parent and sibling position, keyed by a property's canonical path. */
export interface PropertyPlacement {
  parent: string | null
  index: number
}

export interface ClassSchema {
  className: string
  superClass: string | null
  creatable: boolean
  isService?: boolean
  /** Protected instances cannot be moved, duplicated, renamed, or deleted. */
  protected?: boolean
  /** If present, instances of this class may only be parented to this class. */
  fixedParentClass?: string
  /** Only one instance of this class may exist under a given parent. */
  singletonPerParent?: boolean
  description: string
  glyph: string
  glyphColor: string
  properties: PropertySchema[]
}

export interface ClassPropertyOverlay {
  added: PropertySchema[]
  removed: string[]
  overrides: Record<string, Partial<PropertySchema>>
  placements?: Record<string, PropertyPlacement>
}

export type ClassPropertyOverlays = Record<string, ClassPropertyOverlay>

export type NoticeKind = 'error' | 'info'

export interface Notice {
  id: number
  kind: NoticeKind
  message: string
}

export interface DataModelState {
  nodes: Record<InstanceId, InstanceNode>
  classOverlays: ClassPropertyOverlays
  rootId: InstanceId
  selectedId: InstanceId | null
  expanded: Record<InstanceId, boolean>
  nextId: number
  notices: Notice[]
  nextNoticeId: number
}
