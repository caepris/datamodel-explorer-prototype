import { getDefaultProperties } from './classCatalog'
import type { Attribute, DataModelState, InstanceId, InstanceNode, Variant } from './types'

interface SeedSpec {
  key: string
  className: string
  name?: string
  properties?: Record<string, Variant>
  attributes?: Attribute[]
  children?: SeedSpec[]
}

const ref = (key: string): Variant => ({ type: 'Instance', value: `ref:${key}` })
const vec3 = (x: number, y: number, z: number): Variant => ({ type: 'Vector3', value: { x, y, z } })
const color = (r: number, g: number, b: number): Variant => ({ type: 'Color3', value: { r: r / 255, g: g / 255, b: b / 255 } })
const at = (x: number, y: number, z: number, ry = 0): Variant => ({
  type: 'CFrame',
  value: { position: { x, y, z }, orientation: { x: 0, y: ry, z: 0 } },
})

const SEED: SeedSpec = {
  key: 'game',
  className: 'DataModel',
  name: 'Obby Prototype',
  properties: { PlaceId: { type: 'number', value: 1818 }, GameId: { type: 'number', value: 4242 } },
  children: [
    {
      key: 'workspace',
      className: 'Workspace',
      properties: { Terrain: ref('terrain') },
      children: [
        {
          key: 'terrain',
          className: 'Terrain',
          name: 'Terrain',
          properties: {
            Decoration: { type: 'bool', value: true },
            GrassLength: { type: 'number', value: 0.7 },
          },
        },
        {
          key: 'level',
          className: 'Folder',
          name: 'Level',
          children: [
            {
              key: 'spawnPad',
              className: 'Part',
              name: 'SpawnPad',
              properties: {
                Anchored: { type: 'bool', value: true },
                Size: vec3(8, 1, 8),
                CFrame: at(0, 0.5, 0),
                Color: color(75, 151, 75),
                Material: { type: 'enum', value: 'SmoothPlastic' },
              },
              attributes: [{ name: 'Checkpoint', value: { type: 'number', value: 1 } }],
            },
            {
              key: 'gate',
              className: 'Model',
              name: 'Gate',
              properties: { PrimaryPart: ref('door'), WorldPivot: at(0, 5, -20) },
              attributes: [
                { name: 'RequiresKey', value: { type: 'bool', value: true } },
                { name: 'OpenSound', value: { type: 'string', value: 'rbxassetid://0' } },
              ],
              children: [
                {
                  key: 'frame',
                  className: 'Part',
                  name: 'Frame',
                  properties: {
                    Anchored: { type: 'bool', value: true },
                    Size: vec3(12, 10, 1),
                    CFrame: at(0, 5, -20),
                    Material: { type: 'enum', value: 'Wood' },
                    Color: color(124, 92, 70),
                  },
                },
                {
                  key: 'door',
                  className: 'Part',
                  name: 'Door',
                  properties: {
                    Anchored: { type: 'bool', value: true },
                    Size: vec3(8, 8, 0.5),
                    CFrame: at(0, 4, -20),
                    Material: { type: 'enum', value: 'Metal' },
                    Color: color(99, 95, 98),
                  },
                },
              ],
            },
          ],
        },
        {
          key: 'isOpen',
          className: 'BoolValue',
          name: 'IsOpen',
        },
        {
          key: 'avatarPreview',
          className: 'Model',
          name: 'AccessoryPreview',
          children: [
            {
              key: 'previewHead',
              className: 'MeshPart',
              name: 'Head',
              properties: {
                Anchored: { type: 'bool', value: true },
                MeshId: { type: 'string', value: 'rbxassetid://head-mesh' },
                Size: vec3(2, 1, 1),
                CFrame: at(16, 4, 0),
              },
              children: [
                { key: 'headWrapTarget', className: 'WrapTarget', name: 'WrapTarget' },
                {
                  key: 'headSurface',
                  className: 'SurfaceAppearance',
                  name: 'SkinSurface',
                  properties: { ColorMap: { type: 'string', value: 'rbxassetid://skin-color-map' } },
                },
              ],
            },
            {
              key: 'layeredAccessory',
              className: 'Accessory',
              name: 'LayeredJacket',
              properties: { AccessoryType: { type: 'enum', value: 'Jacket' } },
              children: [
                {
                  key: 'accessoryHandle',
                  className: 'MeshPart',
                  name: 'Handle',
                  properties: {
                    MeshId: { type: 'string', value: 'rbxassetid://jacket-mesh' },
                    Size: vec3(3, 4, 1),
                  },
                  children: [
                    { key: 'bodyFrontAttachment', className: 'Attachment', name: 'BodyFrontAttachment' },
                    {
                      key: 'handleWrapLayer',
                      className: 'WrapLayer',
                      name: 'HandleWrapLayer',
                      properties: {
                        ReferenceMeshId: { type: 'string', value: 'rbxassetid://reference-cage' },
                        CageMeshId: { type: 'string', value: 'rbxassetid://outer-cage' },
                        Order: { type: 'number', value: 2 },
                        AutoSkin: { type: 'enum', value: 'EnabledPreserve' },
                      },
                    },
                    {
                      key: 'jacketSurface',
                      className: 'SurfaceAppearance',
                      properties: { ColorMap: { type: 'string', value: 'rbxassetid://jacket-color-map' } },
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          key: 'constraintDemo',
          className: 'Model',
          name: 'ConstraintDemo',
          children: [
            {
              key: 'constraintPartA',
              className: 'Part',
              name: 'AnchorA',
              properties: { Anchored: { type: 'bool', value: true }, CFrame: at(-8, 4, 8) },
              children: [{ key: 'attachmentA', className: 'Attachment', name: 'AttachmentA' }],
            },
            {
              key: 'constraintPartB',
              className: 'Part',
              name: 'MoverB',
              properties: { CFrame: at(-4, 4, 8) },
              children: [{ key: 'attachmentB', className: 'Attachment', name: 'AttachmentB' }],
            },
            {
              key: 'hinge',
              className: 'HingeConstraint',
              properties: {
                Attachment0: ref('attachmentA'),
                Attachment1: ref('attachmentB'),
                ActuatorType: { type: 'enum', value: 'Motor' },
                AngularVelocity: { type: 'number', value: 2 },
              },
            },
            {
              key: 'alignPosition',
              className: 'AlignPosition',
              properties: { Attachment0: ref('attachmentB'), Position: vec3(-4, 8, 8) },
            },
            {
              key: 'noCollision',
              className: 'NoCollisionConstraint',
              properties: { Part0: ref('constraintPartA'), Part1: ref('constraintPartB') },
            },
          ],
        },
        {
          key: 'csgDemo',
          className: 'Folder',
          name: 'CSGDemo',
          children: [
            {
              key: 'unionPlatform',
              className: 'UnionOperation',
              name: 'UnionPlatform',
              properties: {
                Anchored: { type: 'bool', value: true },
                Size: vec3(6, 1, 6),
                CFrame: at(0, 0.5, -8),
                SmoothingAngle: { type: 'number', value: 30 },
                UsePartColor: { type: 'bool', value: true },
              },
            },
            {
              key: 'negateCut',
              className: 'NegateOperation',
              name: 'NegateCut',
              properties: { Anchored: { type: 'bool', value: true }, Transparency: { type: 'number', value: 0.5 } },
            },
            {
              key: 'intersectBlock',
              className: 'IntersectOperation',
              name: 'IntersectBlock',
              properties: { Anchored: { type: 'bool', value: true } },
            },
          ],
        },
      ],
    },
    {
      key: 'lighting',
      className: 'Lighting',
      properties: { ClockTime: { type: 'number', value: 14.5 }, FogColor: color(160, 170, 180), FogEnd: { type: 'number', value: 500 } },
    },
    {
      key: 'materialService',
      className: 'MaterialService',
      children: [
        {
          key: 'fabricVariant',
          className: 'MaterialVariant',
          name: 'LayeredFabric',
          properties: {
            BaseMaterial: { type: 'enum', value: 'Fabric' },
            ColorMap: { type: 'string', value: 'rbxassetid://fabric-color-map' },
            StudsPerTile: { type: 'number', value: 5 },
          },
          children: [
            {
              key: 'fabricTop',
              className: 'TerrainDetail',
              name: 'TopDetail',
              properties: { Face: { type: 'enum', value: 'Top' } },
            },
          ],
        },
      ],
    },
    {
      key: 'replicatedStorage',
      className: 'ReplicatedStorage',
      children: [
        {
          key: 'shared',
          className: 'Folder',
          name: 'Shared',
          children: [
            { key: 'version', className: 'StringValue', name: 'Version', properties: { Value: { type: 'string', value: '0.1.0-prototype' } } },
            { key: 'target', className: 'ObjectValue', name: 'GateTarget', properties: { Value: ref('gate') } },
            {
              key: 'config',
              className: 'ModuleScript',
              name: 'GateConfig',
              properties: { Source: { type: 'string', value: 'return {\n\tOpenSeconds = 3,\n}\n' } },
            },
          ],
        },
      ],
    },
    {
      key: 'serverScriptService',
      className: 'ServerScriptService',
      children: [
        {
          key: 'gameLoop',
          className: 'Script',
          name: 'GameLoop',
          properties: {
            Source: {
              type: 'string',
              value:
                'local gate = workspace.Level.Gate\nlocal isOpen = workspace.IsOpen\n\nisOpen.Changed:Connect(function(open)\n\tgate.Door.CanCollide = not open\nend)\n',
            },
            RunContext: { type: 'enum', value: 'Server' },
          },
        },
      ],
    },
  ],
}

export function createSeedState(): DataModelState {
  const nodes: Record<InstanceId, InstanceNode> = {}
  const keyToId = new Map<string, InstanceId>()
  let nextId = 1

  const assignIds = (spec: SeedSpec) => {
    keyToId.set(spec.key, `inst-${nextId++}`)
    spec.children?.forEach(assignIds)
  }
  assignIds(SEED)

  const resolve = (value: Variant): Variant =>
    value.type === 'Instance' && value.value?.startsWith('ref:')
      ? { type: 'Instance', value: keyToId.get(value.value.slice(4)) ?? null }
      : structuredClone(value)

  const build = (spec: SeedSpec, parentId: InstanceId | null) => {
    const id = keyToId.get(spec.key)!
    const properties = getDefaultProperties(spec.className)
    for (const [key, value] of Object.entries(spec.properties ?? {})) properties[key] = resolve(value)
    nodes[id] = {
      id,
      className: spec.className,
      name: spec.name ?? spec.className,
      parentId,
      children: (spec.children ?? []).map((child) => keyToId.get(child.key)!),
      properties,
      attributes: structuredClone(spec.attributes ?? []),
    }
    spec.children?.forEach((child) => build(child, id))
  }
  build(SEED, null)

  const rootId = keyToId.get('game')!
  return {
    nodes,
    classOverlays: {},
    rootId,
    selectedId: keyToId.get('spawnPad')!,
    expanded: {
      [rootId]: true,
      [keyToId.get('workspace')!]: true,
      [keyToId.get('level')!]: true,
    },
    nextId,
    notices: [],
    nextNoticeId: 1,
  }
}
