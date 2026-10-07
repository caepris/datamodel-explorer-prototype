import { describe, expect, it } from 'vitest'
import { parseBulkProperties } from './bulkProperties'
import { getClass, getCreatableClasses, getVisibleProperties } from './classCatalog'
import { dataModelReducer, type DataModelAction } from './dataModelReducer'
import { createSeedState } from './seed'
import { getDescendantIds, getPropertyValue } from './tree'
import type { DataModelState } from './types'

function apply(state: DataModelState, ...actions: DataModelAction[]): DataModelState {
  return actions.reduce(dataModelReducer, state)
}

function idOf(state: DataModelState, name: string): string {
  const node = Object.values(state.nodes).find((n) => n.name === name)
  if (!node) throw new Error(`No instance named ${name}`)
  return node.id
}

const lastNotice = (state: DataModelState) => state.notices.at(-1)

describe('seed', () => {
  it('roots the place at a DataModel whose children are services', () => {
    const state = createSeedState()
    const root = state.nodes[state.rootId]
    expect(root.className).toBe('DataModel')
    expect(root.children.map((id) => state.nodes[id].className)).toEqual([
      'Workspace',
      'Lighting',
      'MaterialService',
      'ReplicatedStorage',
      'ServerScriptService',
    ])
  })

  it('keeps parent and children links consistent', () => {
    const state = createSeedState()
    for (const node of Object.values(state.nodes)) {
      for (const child of node.children) expect(state.nodes[child].parentId).toBe(node.id)
      if (node.parentId) expect(state.nodes[node.parentId].children).toContain(node.id)
    }
  })
})

describe('createInstance', () => {
  it('creates a creatable class under the parent with default properties and selects it', () => {
    const seed = createSeedState()
    const folderId = idOf(seed, 'Level')
    const state = apply(seed, { type: 'createInstance', className: 'Part', parentId: folderId })
    const created = state.nodes[state.selectedId!]
    expect(created.className).toBe('Part')
    expect(created.name).toBe('Part')
    expect(created.parentId).toBe(folderId)
    expect(state.nodes[folderId].children.at(-1)).toBe(created.id)
    expect(created.properties.Anchored).toEqual({ type: 'bool', value: false })
  })

  it('rejects abstract classes and services', () => {
    const seed = createSeedState()
    const level = idOf(seed, 'Level')
    const abstract = apply(seed, { type: 'createInstance', className: 'BasePart', parentId: level })
    expect(Object.keys(abstract.nodes)).toHaveLength(Object.keys(seed.nodes).length)
    expect(lastNotice(abstract)?.message).toMatch(/not creatable/)
    const service = apply(seed, { type: 'createInstance', className: 'Workspace', parentId: level })
    expect(lastNotice(service)?.kind).toBe('error')
  })

  it('rejects non-services directly under the DataModel', () => {
    const seed = createSeedState()
    const state = apply(seed, { type: 'createInstance', className: 'Folder', parentId: seed.rootId })
    expect(lastNotice(state)?.message).toMatch(/Only services/)
  })
})

describe('deleteInstance', () => {
  it('removes the whole subtree and clears references into it', () => {
    const seed = createSeedState()
    const gate = idOf(seed, 'Gate')
    const descendants = getDescendantIds(seed, gate)
    const target = idOf(seed, 'GateTarget')
    expect(seed.nodes[target].properties.Value).toEqual({ type: 'Instance', value: gate })

    const state = apply(seed, { type: 'deleteInstance', id: gate })
    for (const id of [gate, ...descendants]) expect(state.nodes[id]).toBeUndefined()
    expect(state.nodes[idOf(seed, 'Level')].children).not.toContain(gate)
    expect(state.nodes[target].properties.Value).toEqual({ type: 'Instance', value: null })
  })

  it('refuses to delete services or the root', () => {
    const seed = createSeedState()
    const workspace = idOf(seed, 'Workspace')
    expect(apply(seed, { type: 'deleteInstance', id: workspace }).nodes[workspace]).toBeDefined()
    expect(apply(seed, { type: 'deleteInstance', id: seed.rootId }).nodes[seed.rootId]).toBeDefined()
  })
})

describe('renameInstance', () => {
  it('truncates names to 100 characters', () => {
    const seed = createSeedState()
    const id = idOf(seed, 'SpawnPad')
    const state = apply(seed, { type: 'renameInstance', id, name: 'x'.repeat(150) })
    expect(state.nodes[id].name).toHaveLength(100)
    expect(lastNotice(state)?.kind).toBe('info')
  })

  it('renames through the Name property too', () => {
    const seed = createSeedState()
    const id = idOf(seed, 'SpawnPad')
    const state = apply(seed, { type: 'setProperty', id, property: 'Name', value: { type: 'string', value: 'Start' } })
    expect(state.nodes[id].name).toBe('Start')
  })
})

describe('reparentInstance', () => {
  it('moves an instance atomically between parents', () => {
    const seed = createSeedState()
    const frame = idOf(seed, 'Frame')
    const gate = idOf(seed, 'Gate')
    const shared = idOf(seed, 'Shared')
    const state = apply(seed, { type: 'reparentInstance', id: frame, parentId: shared })
    expect(state.nodes[frame].parentId).toBe(shared)
    expect(state.nodes[gate].children).not.toContain(frame)
    expect(state.nodes[shared].children).toContain(frame)
  })

  it('clears a Model PrimaryPart when that part leaves the model', () => {
    const seed = createSeedState()
    const door = idOf(seed, 'Door')
    const gate = idOf(seed, 'Gate')
    const state = apply(seed, { type: 'reparentInstance', id: door, parentId: idOf(seed, 'Level') })
    expect(state.nodes[gate].properties.PrimaryPart).toEqual({ type: 'Instance', value: null })
    expect(lastNotice(state)?.message).toMatch(/Gate\.PrimaryPart/)
  })

  it('rejects circular parenting', () => {
    const seed = createSeedState()
    const level = idOf(seed, 'Level')
    const state = apply(seed, { type: 'reparentInstance', id: level, parentId: idOf(seed, 'SpawnPad') })
    expect(state.nodes[level].parentId).toBe(idOf(seed, 'Workspace'))
    expect(lastNotice(state)?.message).toMatch(/circular reference/)
  })

  it('rejects self parenting', () => {
    const seed = createSeedState()
    const level = idOf(seed, 'Level')
    const state = apply(seed, { type: 'reparentInstance', id: level, parentId: level })
    expect(lastNotice(state)?.message).toMatch(/its own parent/)
  })

  it('keeps service parents locked', () => {
    const seed = createSeedState()
    const lighting = idOf(seed, 'Lighting')
    const state = apply(seed, { type: 'reparentInstance', id: lighting, parentId: idOf(seed, 'Level') })
    expect(state.nodes[lighting].parentId).toBe(seed.rootId)
    expect(lastNotice(state)?.message).toMatch(/locked/)
  })
})

describe('setProperty', () => {
  it('updates typed values and clamps ranged numbers', () => {
    const seed = createSeedState()
    const id = idOf(seed, 'SpawnPad')
    const state = apply(
      seed,
      { type: 'setProperty', id, property: 'Transparency', value: { type: 'number', value: 4 } },
      { type: 'setProperty', id, property: 'Material', value: { type: 'enum', value: 'Neon' } },
      { type: 'setProperty', id, property: 'Size', value: { type: 'Vector3', value: { x: 2, y: 3, z: 4 } } },
    )
    expect(state.nodes[id].properties.Transparency).toEqual({ type: 'number', value: 1 })
    expect(state.nodes[id].properties.Material).toEqual({ type: 'enum', value: 'Neon' })
    expect(state.nodes[id].properties.Size).toEqual({ type: 'Vector3', value: { x: 2, y: 3, z: 4 } })
  })

  it('rejects invalid values, unknown enums, and read-only properties', () => {
    const seed = createSeedState()
    const id = idOf(seed, 'SpawnPad')
    const nan = apply(seed, { type: 'setProperty', id, property: 'Reflectance', value: { type: 'number', value: NaN } })
    expect(lastNotice(nan)?.message).toMatch(/finite number/)
    const badEnum = apply(seed, { type: 'setProperty', id, property: 'Material', value: { type: 'enum', value: 'Lava' } })
    expect(lastNotice(badEnum)?.message).toMatch(/not a valid Material/)
    const mass = apply(seed, { type: 'setProperty', id, property: 'AssemblyMass', value: { type: 'number', value: 1 } })
    expect(lastNotice(mass)?.message).toMatch(/read-only/)
  })

  it('computes read-only derived values', () => {
    const seed = createSeedState()
    const node = seed.nodes[idOf(seed, 'SpawnPad')]
    const mass = getVisibleProperties('Part').find((p) => p.name === 'AssemblyMass')!
    expect(getPropertyValue(node, mass)).toEqual({ type: 'number', value: 44.8 })
  })

  it('enforces reference constraints', () => {
    const seed = createSeedState()
    const gate = idOf(seed, 'Gate')
    const outside = apply(seed, {
      type: 'setProperty',
      id: gate,
      property: 'PrimaryPart',
      value: { type: 'Instance', value: idOf(seed, 'SpawnPad') },
    })
    expect(lastNotice(outside)?.message).toMatch(/descendant of Gate/)
    const wrongClass = apply(seed, {
      type: 'setProperty',
      id: gate,
      property: 'PrimaryPart',
      value: { type: 'Instance', value: idOf(seed, 'Level') },
    })
    expect(lastNotice(wrongClass)?.message).toMatch(/must reference a BasePart/)
  })

  it('resets a property to its class default', () => {
    const seed = createSeedState()
    const id = idOf(seed, 'SpawnPad')
    const state = apply(seed, { type: 'resetProperty', id, property: 'Anchored' })
    expect(state.nodes[id].properties.Anchored).toEqual({ type: 'bool', value: false })
  })

  it('hides non-public properties from the panel', () => {
    const names = getVisibleProperties('Part').map((p) => p.name)
    expect(names).toContain('Size')
    expect(names).not.toContain('size')
    expect(names).not.toContain('RobloxLocked')
  })
})

describe('attributes', () => {
  it('supports add, edit, rename, retype, and remove', () => {
    const seed = createSeedState()
    const id = idOf(seed, 'Level')
    let state = apply(seed, { type: 'addAttribute', id, name: 'Difficulty', attributeType: 'number' })
    expect(state.nodes[id].attributes).toEqual([{ name: 'Difficulty', value: { type: 'number', value: 0 } }])

    state = apply(
      state,
      { type: 'setAttribute', id, name: 'Difficulty', value: { type: 'number', value: 3 } },
      { type: 'renameAttribute', id, name: 'Difficulty', newName: 'Tier' },
    )
    expect(state.nodes[id].attributes).toEqual([{ name: 'Tier', value: { type: 'number', value: 3 } }])

    state = apply(state, { type: 'setAttributeType', id, name: 'Tier', attributeType: 'string' })
    expect(state.nodes[id].attributes[0].value).toEqual({ type: 'string', value: '' })

    state = apply(state, { type: 'removeAttribute', id, name: 'Tier' })
    expect(state.nodes[id].attributes).toEqual([])
  })

  it('rejects duplicate, reserved, and malformed names', () => {
    const seed = createSeedState()
    const id = idOf(seed, 'Gate')
    expect(lastNotice(apply(seed, { type: 'addAttribute', id, name: 'RequiresKey', attributeType: 'bool' }))?.message).toMatch(
      /already exists/,
    )
    expect(lastNotice(apply(seed, { type: 'addAttribute', id, name: 'RBXSecret', attributeType: 'bool' }))?.message).toMatch(
      /reserved/,
    )
    expect(lastNotice(apply(seed, { type: 'addAttribute', id, name: 'has space', attributeType: 'bool' }))?.message).toMatch(
      /letters, digits/,
    )
  })

  it('rejects values of the wrong type', () => {
    const seed = createSeedState()
    const id = idOf(seed, 'Gate')
    const state = apply(seed, { type: 'setAttribute', id, name: 'RequiresKey', value: { type: 'string', value: 'yes' } })
    expect(state.nodes[id].attributes[0].value).toEqual({ type: 'bool', value: true })
    expect(lastNotice(state)?.kind).toBe('error')
  })
})

describe('duplicateInstance', () => {
  it('deep-copies a subtree and remaps internal references', () => {
    const seed = createSeedState()
    const gate = idOf(seed, 'Gate')
    const state = apply(seed, { type: 'duplicateInstance', id: gate })
    const copy = state.nodes[state.selectedId!]
    expect(copy.id).not.toBe(gate)
    expect(copy.name).toBe('Gate')
    expect(copy.children).toHaveLength(2)
    const primary = copy.properties.PrimaryPart
    expect(primary.type === 'Instance' && primary.value && copy.children.includes(primary.value)).toBe(true)
  })
})

describe('reset', () => {
  it('restores the seed place', () => {
    const seed = createSeedState()
    const state = apply(seed, { type: 'deleteInstance', id: idOf(seed, 'Gate') }, { type: 'reset' })
    expect(Object.keys(state.nodes)).toHaveLength(Object.keys(seed.nodes).length)
    expect(state.notices).toEqual([])
  })
})

describe('class property customization', () => {
  it('adds a class property to every existing and future instance of that class', () => {
    const seed = createSeedState()
    const property = {
      name: 'ProductState',
      category: 'Product',
      type: 'enum' as const,
      enumValues: ['Concept', 'Beta', 'Shipped'],
      defaultValue: { type: 'enum' as const, value: 'Concept' },
    }
    let state = apply(seed, { type: 'addClassProperty', className: 'Part', property })
    expect(state.nodes[idOf(state, 'SpawnPad')].properties.ProductState).toEqual(property.defaultValue)
    expect(getVisibleProperties('Part', state.classOverlays).map((item) => item.name)).toContain('ProductState')

    state = apply(state, { type: 'createInstance', className: 'Part', parentId: idOf(state, 'Level') })
    expect(state.nodes[state.selectedId!].properties.ProductState).toEqual(property.defaultValue)
  })

  it('inherits custom properties through the class hierarchy', () => {
    const seed = createSeedState()
    const state = apply(seed, {
      type: 'addClassProperty',
      className: 'BasePart',
      property: {
        name: 'DesignerNote',
        category: 'Product',
        type: 'string',
        defaultValue: { type: 'string', value: 'Review me' },
      },
    })
    expect(state.nodes[idOf(state, 'SpawnPad')].properties.DesignerNote).toEqual({ type: 'string', value: 'Review me' })
    expect(state.nodes[idOf(state, 'Head')].properties.DesignerNote).toEqual({ type: 'string', value: 'Review me' })
  })

  it('renames and retypes a custom property and resets existing values', () => {
    const seed = createSeedState()
    let state = apply(seed, {
      type: 'addClassProperty',
      className: 'Part',
      property: { name: 'Priority', category: 'Data', type: 'number', defaultValue: { type: 'number', value: 1 } },
    })
    state = apply(
      state,
      {
        type: 'setProperty',
        id: idOf(state, 'SpawnPad'),
        property: 'Priority',
        value: { type: 'number', value: 5 },
      },
      {
        type: 'updateClassProperty',
        className: 'Part',
        propertyName: 'Priority',
        property: {
          name: 'PriorityLabel',
          category: 'Product',
          type: 'string',
          defaultValue: { type: 'string', value: 'Normal' },
        },
      },
    )
    expect(state.nodes[idOf(state, 'SpawnPad')].properties.Priority).toBeUndefined()
    expect(state.nodes[idOf(state, 'SpawnPad')].properties.PriorityLabel).toEqual({ type: 'string', value: 'Normal' })
  })

  it('renames and retypes a built-in property without changing other classes', () => {
    const seed = createSeedState()
    const id = idOf(seed, 'SpawnPad')
    const anchored = getVisibleProperties('Part').find((item) => item.name === 'Anchored')!
    let state = apply(seed, {
      type: 'updateClassProperty',
      className: 'Part',
      propertyName: 'Anchored',
      property: {
        ...anchored,
        name: 'Pinned',
        category: 'Product',
        type: 'string',
        defaultValue: { type: 'string', value: 'yes' },
      },
    })
    const pinned = getVisibleProperties('Part', state.classOverlays).find((item) => item.name === 'Pinned')
    expect(pinned?.type).toBe('string')
    expect(pinned?.category).toBe('Product')
    expect(getVisibleProperties('Part', state.classOverlays).some((item) => item.name === 'Anchored')).toBe(false)
    expect(state.nodes[id].properties.Pinned).toEqual({ type: 'string', value: 'yes' })
    expect(state.nodes[id].properties.Anchored).toBeUndefined()
    expect(getVisibleProperties('MeshPart', state.classOverlays).some((item) => item.name === 'Anchored')).toBe(true)

    const collide = getVisibleProperties('Part', state.classOverlays).find((item) => item.name === 'CanCollide')!
    state = apply(state, {
      type: 'updateClassProperty',
      className: 'Part',
      propertyName: 'CanCollide',
      property: { ...collide, type: 'string', defaultValue: { type: 'string', value: 'on' } },
    })
    expect(getVisibleProperties('Part', state.classOverlays).find((item) => item.name === 'CanCollide')?.type).toBe('string')
    expect(state.nodes[id].properties.CanCollide).toEqual({ type: 'string', value: 'on' })
    expect(getVisibleProperties('MeshPart', state.classOverlays).find((item) => item.name === 'CanCollide')?.type).toBe('bool')
  })

  it('duplicates a property beside the original, including subproperties and values', () => {
    const seed = createSeedState()
    const id = idOf(seed, 'SpawnPad')
    let state = apply(
      seed,
      { type: 'setProperty', id, property: 'Anchored', value: { type: 'bool', value: false } },
      { type: 'duplicateClassProperty', className: 'Part', propertyName: 'Anchored' },
    )
    const names = getVisibleProperties('Part', state.classOverlays).map((item) => item.name)
    expect(names[names.indexOf('Anchored') + 1]).toBe('Anchored2')
    expect(state.nodes[id].properties.Anchored).toEqual({ type: 'bool', value: false })
    expect(state.nodes[id].properties.Anchored2).toEqual({ type: 'bool', value: false })
    expect(getVisibleProperties('MeshPart', state.classOverlays).some((item) => item.name === 'Anchored2')).toBe(false)

    state = apply(state, { type: 'duplicateClassProperty', className: 'Part', propertyName: 'Anchored2' })
    expect(state.nodes[id].properties.Anchored3).toEqual({ type: 'bool', value: false })

    state = apply(
      state,
      {
        type: 'addClassProperty',
        className: 'Part',
        property: {
          name: 'FeatureEnabled',
          category: 'Behavior',
          type: 'bool',
          defaultValue: { type: 'bool', value: false },
          gatesChildren: true,
          children: [
            { name: 'RetryCount', category: 'Behavior', type: 'number', defaultValue: { type: 'number', value: 0 } },
          ],
        },
      },
      { type: 'setProperty', id, property: 'FeatureEnabled', value: { type: 'bool', value: true } },
      { type: 'setProperty', id, property: 'FeatureEnabled.RetryCount', value: { type: 'number', value: 5 } },
      { type: 'duplicateClassProperty', className: 'Part', propertyName: 'FeatureEnabled' },
    )
    const copy = getVisibleProperties('Part', state.classOverlays).find((item) => item.name === 'FeatureEnabled2')
    expect(copy?.gatesChildren).toBe(true)
    expect(copy?.children?.map((item) => item.name)).toEqual(['RetryCount'])
    expect(state.nodes[id].properties.FeatureEnabled2).toEqual({ type: 'bool', value: true })
    expect(state.nodes[id].properties['FeatureEnabled2.RetryCount']).toEqual({ type: 'number', value: 5 })
    expect(state.nodes[id].properties['FeatureEnabled.RetryCount']).toEqual({ type: 'number', value: 5 })
    expect(lastNotice(apply(state, { type: 'duplicateClassProperty', className: 'Part', propertyName: 'Name' }))?.message).toMatch(/unique/)
  })

  it('removes a property for a class and descendants, then restores the class', () => {
    const seed = createSeedState()
    let state = apply(seed, { type: 'removeClassProperty', className: 'BasePart', propertyName: 'Color' })
    expect(getVisibleProperties('Part', state.classOverlays).map((item) => item.name)).not.toContain('Color')
    expect(getVisibleProperties('MeshPart', state.classOverlays).map((item) => item.name)).not.toContain('Color')
    expect(state.nodes[idOf(state, 'SpawnPad')].properties.Color).toBeUndefined()

    state = apply(state, { type: 'restoreClassProperties', className: 'BasePart' })
    expect(getVisibleProperties('Part', state.classOverlays).map((item) => item.name)).toContain('Color')
    expect(state.nodes[idOf(state, 'SpawnPad')].properties.Color?.type).toBe('Color3')
  })

  it('reorders, nests, and recategorizes properties without losing values', () => {
    const seed = createSeedState()
    const id = idOf(seed, 'SpawnPad')
    const originalColor = seed.nodes[id].properties.Color
    let state = apply(
      seed,
      {
        type: 'addClassProperty',
        className: 'Part',
        property: { name: 'Alpha', category: 'Product', type: 'string', defaultValue: { type: 'string', value: 'a' } },
      },
      {
        type: 'addClassProperty',
        className: 'Part',
        property: { name: 'Beta', category: 'Product', type: 'string', defaultValue: { type: 'string', value: 'b' } },
      },
      { type: 'setProperty', id, property: 'Beta', value: { type: 'string', value: 'edited' } },
      { type: 'moveClassProperty', className: 'Part', propertyName: 'Beta', parentPath: null, before: 'Alpha' },
    )
    expect(
      getVisibleProperties('Part', state.classOverlays)
        .filter((item) => item.category === 'Product')
        .map((item) => item.name),
    ).toEqual(['Beta', 'Alpha'])

    state = apply(state, { type: 'moveClassProperty', className: 'Part', propertyName: 'Alpha', parentPath: 'Beta', before: null })
    expect(state.nodes[id].properties.Alpha).toBeUndefined()
    expect(state.nodes[id].properties['Beta.Alpha']).toEqual({ type: 'string', value: 'a' })
    expect(state.nodes[id].properties.Beta).toEqual({ type: 'string', value: 'edited' })

    state = apply(state, {
      type: 'moveClassProperty',
      className: 'Part',
      propertyName: 'Color',
      parentPath: 'Beta',
      before: null,
    })
    expect(state.nodes[id].properties.Color).toBeUndefined()
    expect(state.nodes[id].properties['Beta.Color']).toEqual(originalColor)
    expect(state.nodes[idOf(state, 'Head')].properties.Color?.type).toBe('Color3')

    state = apply(state, {
      type: 'moveClassProperty',
      className: 'Part',
      propertyName: 'Beta',
      parentPath: null,
      before: null,
      category: 'Behavior',
    })
    const beta = getVisibleProperties('Part', state.classOverlays).find((item) => item.name === 'Beta')
    expect(beta?.category).toBe('Behavior')
    expect(beta?.children?.map((child) => child.name)).toEqual(['Alpha', 'Color'])
    expect(state.nodes[id].properties['Beta.Color']).toEqual(originalColor)

    state = apply(state, { type: 'restoreClassProperties', className: 'Part' })
    expect(getVisibleProperties('Part', state.classOverlays).find((item) => item.name === 'Beta')).toBeUndefined()
    expect(state.nodes[id].properties.Color?.type).toBe('Color3')
  })

  it('rejects circular property moves and duplicate sibling names', () => {
    const seed = createSeedState()
    let state = apply(seed, {
      type: 'addClassProperty',
      className: 'Part',
      property: {
        name: 'Group',
        category: 'Product',
        type: 'bool',
        defaultValue: { type: 'bool', value: true },
        children: [{ name: 'Anchored', category: 'Product', type: 'string', defaultValue: { type: 'string', value: 'custom' } }],
      },
    })
    const cycle = apply(state, { type: 'moveClassProperty', className: 'Part', propertyName: 'Group', parentPath: 'Group.Anchored', before: null })
    expect(lastNotice(cycle)?.message).toMatch(/inside itself/)
    const duplicate = apply(state, { type: 'moveClassProperty', className: 'Part', propertyName: 'Anchored', parentPath: 'Group', before: null })
    expect(lastNotice(duplicate)?.message).toMatch(/already exists/)
    const pinned = apply(state, { type: 'moveClassProperty', className: 'Part', propertyName: 'Name', parentPath: null, before: 'Anchored' })
    expect(lastNotice(pinned)?.message).toMatch(/stays at the top/)
  })

  it('inherits a base-class property move', () => {
    const seed = createSeedState()
    const state = apply(
      seed,
      {
        type: 'addClassProperty',
        className: 'BasePart',
        property: { name: 'Group', category: 'Product', type: 'string', defaultValue: { type: 'string', value: 'group' } },
      },
      { type: 'moveClassProperty', className: 'BasePart', propertyName: 'Reflectance', parentPath: 'Group', before: null },
    )
    expect(getVisibleProperties('Part', state.classOverlays).find((item) => item.name === 'Group')?.children?.[0].name).toBe('Reflectance')
    expect(getVisibleProperties('MeshPart', state.classOverlays).find((item) => item.name === 'Group')?.children?.[0].name).toBe('Reflectance')
    expect(state.nodes[idOf(state, 'SpawnPad')].properties['Group.Reflectance']).toEqual({ type: 'number', value: 0 })
  })

  it('bulk adds a property list and leaves the class unchanged when a name conflicts', () => {
    const seed = createSeedState()
    const parsed = parseBulkProperties(`Health number
FeatureEnabled bool @Behavior gates
  RetryCount number
  Note string readonly`)
    if (!('properties' in parsed)) throw new Error(parsed.error)
    const state = apply(seed, { type: 'addClassProperties', className: 'Part', properties: parsed.properties })
    const part = state.nodes[idOf(state, 'SpawnPad')]
    expect(part.properties.Health).toEqual({ type: 'number', value: 0 })
    expect(part.properties['FeatureEnabled.RetryCount']).toEqual({ type: 'number', value: 0 })
    const feature = getVisibleProperties('Part', state.classOverlays).find((item) => item.name === 'FeatureEnabled')
    expect(feature?.category).toBe('Behavior')
    expect(feature?.gatesChildren).toBe(true)
    expect(feature?.children?.find((child) => child.name === 'Note')?.readOnly).toBe(true)

    const rejected = apply(state, {
      type: 'addClassProperties',
      className: 'Part',
      properties: [
        { name: 'Fresh', category: 'Data', type: 'string', defaultValue: { type: 'string', value: '' } },
        { name: 'Health', category: 'Data', type: 'string', defaultValue: { type: 'string', value: '' } },
      ],
    })
    expect(lastNotice(rejected)?.message).toMatch(/already exists/)
    expect(rejected.nodes[idOf(rejected, 'SpawnPad')].properties.Fresh).toBeUndefined()
    expect(parseBulkProperties('Team enum')).toEqual({ error: 'Line 1: list enum options after =.' })
  })

  it('protects the Explorer identity properties', () => {
    const seed = createSeedState()
    const state = apply(seed, { type: 'removeClassProperty', className: 'Part', propertyName: 'Name' })
    expect(lastNotice(state)?.message).toMatch(/required by the Explorer/)
    expect(getVisibleProperties('Part', state.classOverlays).map((item) => item.name)).toContain('Name')
  })

  it('adds recursive properties and enforces boolean gating without losing values', () => {
    const seed = createSeedState()
    const id = idOf(seed, 'SpawnPad')
    let state = apply(
      seed,
      {
        type: 'addClassProperty',
        className: 'Part',
        property: {
          name: 'FeatureEnabled',
          category: 'Product',
          type: 'bool',
          defaultValue: { type: 'bool', value: false },
          gatesChildren: true,
        },
      },
      {
        type: 'addClassProperty',
        className: 'Part',
        parentPath: 'FeatureEnabled',
        property: {
          name: 'RetryCount',
          category: 'Product',
          type: 'number',
          defaultValue: { type: 'number', value: 2 },
        },
      },
      {
        type: 'addClassProperty',
        className: 'Part',
        parentPath: 'FeatureEnabled.RetryCount',
        property: {
          name: 'Note',
          category: 'Product',
          type: 'string',
          defaultValue: { type: 'string', value: 'kept' },
        },
      },
    )
    expect(state.nodes[id].properties['FeatureEnabled.RetryCount']).toEqual({ type: 'number', value: 2 })
    expect(state.nodes[id].properties['FeatureEnabled.RetryCount.Note']).toEqual({ type: 'string', value: 'kept' })

    state = apply(state, {
      type: 'setProperty',
      id,
      property: 'FeatureEnabled.RetryCount',
      value: { type: 'number', value: 5 },
    })
    expect(state.nodes[id].properties['FeatureEnabled.RetryCount']).toEqual({ type: 'number', value: 2 })
    expect(lastNotice(state)?.message).toMatch(/read-only/)

    state = apply(
      state,
      { type: 'setProperty', id, property: 'FeatureEnabled', value: { type: 'bool', value: true } },
      {
        type: 'setProperty',
        id,
        property: 'FeatureEnabled.RetryCount',
        value: { type: 'number', value: 5 },
      },
      { type: 'setProperty', id, property: 'FeatureEnabled', value: { type: 'bool', value: false } },
    )
    expect(state.nodes[id].properties['FeatureEnabled.RetryCount']).toEqual({ type: 'number', value: 5 })
  })

  it('migrates descendant values on rename and removes or restores complete subtrees', () => {
    const seed = createSeedState()
    const id = idOf(seed, 'SpawnPad')
    let state = apply(seed, {
      type: 'addClassProperty',
      className: 'BasePart',
      property: {
        name: 'Product',
        category: 'Product',
        type: 'string',
        defaultValue: { type: 'string', value: 'root' },
        children: [
          {
            name: 'Label',
            category: 'Product',
            type: 'string',
            defaultValue: { type: 'string', value: 'Draft' },
          },
        ],
      },
    })
    state = apply(
      state,
      { type: 'setProperty', id, property: 'Product.Label', value: { type: 'string', value: 'Ready' } },
      {
        type: 'updateClassProperty',
        className: 'BasePart',
        propertyName: 'Product',
        property: {
          ...getVisibleProperties('Part', state.classOverlays).find((item) => item.name === 'Product')!,
          name: 'Launch',
        },
      },
    )
    expect(state.nodes[id].properties['Product.Label']).toBeUndefined()
    expect(state.nodes[id].properties['Launch.Label']).toEqual({ type: 'string', value: 'Ready' })

    state = apply(state, { type: 'removeClassProperty', className: 'BasePart', propertyName: 'Launch.Label' })
    expect(state.nodes[id].properties['Launch.Label']).toBeUndefined()
    expect(getVisibleProperties('MeshPart', state.classOverlays).find((item) => item.name === 'Launch')?.children ?? []).toEqual([])

    state = apply(state, { type: 'restoreClassProperties', className: 'BasePart' })
    expect(getVisibleProperties('Part', state.classOverlays).find((item) => item.name === 'Launch')).toBeUndefined()
    expect(state.nodes[id].properties.Launch).toBeUndefined()
  })

  it('edits a custom subproperty nested under a built-in property', () => {
    const seed = createSeedState()
    const id = idOf(seed, 'SpawnPad')
    let state = apply(
      seed,
      {
        type: 'addClassProperty',
        className: 'Part',
        parentPath: 'Material',
        property: {
          name: 'MaterialMask',
          category: 'Appearance',
          type: 'string',
          defaultValue: { type: 'string', value: '' },
        },
      },
      {
        type: 'addClassProperty',
        className: 'Part',
        parentPath: 'Material.MaterialMask',
        property: {
          name: 'Detail',
          category: 'Appearance',
          type: 'number',
          defaultValue: { type: 'number', value: 1 },
        },
      },
      { type: 'setProperty', id, property: 'Material.MaterialMask', value: { type: 'string', value: 'mask' } },
      { type: 'setProperty', id, property: 'Material.MaterialMask.Detail', value: { type: 'number', value: 4 } },
      {
        type: 'updateClassProperty',
        className: 'Part',
        propertyName: 'Material.MaterialMask',
        property: {
          name: 'MaskId',
          category: 'Appearance',
          type: 'string',
          description: 'Which mask',
          defaultValue: { type: 'string', value: '' },
        },
      },
    )
    const material = getVisibleProperties('Part', state.classOverlays).find((item) => item.name === 'Material')
    const renamed = material?.children?.find((item) => item.name === 'MaskId')
    expect(renamed?.description).toBe('Which mask')
    expect(renamed?.children?.map((item) => item.name)).toEqual(['Detail'])
    expect(material?.children?.some((item) => item.name === 'MaterialMask')).toBe(false)
    expect(state.nodes[id].properties['Material.MaskId']).toEqual({ type: 'string', value: 'mask' })
    expect(state.nodes[id].properties['Material.MaskId.Detail']).toEqual({ type: 'number', value: 4 })
    expect(lastNotice(state)?.kind).not.toBe('error')
  })

  it('allows the same nested name under different parents but rejects duplicate siblings', () => {
    let state = createSeedState()
    for (const rootName of ['Visuals', 'Physics']) {
      state = apply(
        state,
        {
          type: 'addClassProperty',
          className: 'Part',
          property: {
            name: rootName,
            category: 'Product',
            type: 'bool',
            defaultValue: { type: 'bool', value: true },
          },
        },
        {
          type: 'addClassProperty',
          className: 'Part',
          parentPath: rootName,
          property: {
            name: 'Enabled',
            category: 'Product',
            type: 'bool',
            defaultValue: { type: 'bool', value: true },
          },
        },
      )
    }
    expect(state.nodes[idOf(state, 'SpawnPad')].properties['Visuals.Enabled']).toBeDefined()
    expect(state.nodes[idOf(state, 'SpawnPad')].properties['Physics.Enabled']).toBeDefined()

    const rejected = apply(state, {
      type: 'addClassProperty',
      className: 'Part',
      parentPath: 'Visuals',
      property: {
        name: 'Enabled',
        category: 'Product',
        type: 'bool',
        defaultValue: { type: 'bool', value: false },
      },
    })
    expect(lastNotice(rejected)?.message).toMatch(/already exists/)
  })
})

describe('expanded engine catalog', () => {
  it('includes mesh, accessory, terrain, constraint, UI constraint, and CSG classes', () => {
    for (const className of [
      'MeshPart',
      'SurfaceAppearance',
      'MaterialVariant',
      'Accessory',
      'WrapLayer',
      'Terrain',
      'HingeConstraint',
      'LinearVelocity',
      'UIAspectRatioConstraint',
      'UnionOperation',
      'NegateOperation',
      'IntersectOperation',
    ]) {
      expect(getClass(className).className).toBe(className)
    }
    const creatable = getCreatableClasses().map((schema) => schema.className)
    expect(creatable).toContain('MeshPart')
    expect(creatable).toContain('WrapLayer')
    expect(creatable).toContain('HingeConstraint')
    expect(creatable).toContain('UnionOperation')
    expect(creatable).not.toContain('Terrain')
    expect(creatable).not.toContain('Constraint')
    expect(creatable).not.toContain('PartOperation')
  })

  it('seeds representative accessory, terrain, constraint, and CSG trees', () => {
    const state = createSeedState()
    expect(state.nodes[idOf(state, 'Terrain')].parentId).toBe(idOf(state, 'Workspace'))
    expect(state.nodes[idOf(state, 'Handle')].parentId).toBe(idOf(state, 'LayeredJacket'))
    expect(state.nodes[idOf(state, 'HandleWrapLayer')].parentId).toBe(idOf(state, 'Handle'))
    expect(state.nodes[idOf(state, 'HingeConstraint')].properties.Attachment0).toEqual({
      type: 'Instance',
      value: idOf(state, 'AttachmentA'),
    })
    expect(state.nodes[idOf(state, 'UnionPlatform')].className).toBe('UnionOperation')
  })

  it('keeps Terrain locked to Workspace and protected from deletion and duplication', () => {
    const seed = createSeedState()
    const terrain = idOf(seed, 'Terrain')
    const moved = apply(seed, { type: 'reparentInstance', id: terrain, parentId: idOf(seed, 'Level') })
    expect(moved.nodes[terrain].parentId).toBe(idOf(seed, 'Workspace'))
    expect(lastNotice(moved)?.message).toMatch(/locked/)
    expect(apply(seed, { type: 'deleteInstance', id: terrain }).nodes[terrain]).toBeDefined()
    expect(apply(seed, { type: 'duplicateInstance', id: terrain }).nodes).toEqual(seed.nodes)
  })

  it('validates constraint Attachment and BasePart references', () => {
    const seed = createSeedState()
    const hinge = idOf(seed, 'HingeConstraint')
    const badAttachment = apply(seed, {
      type: 'setProperty',
      id: hinge,
      property: 'Attachment0',
      value: { type: 'Instance', value: idOf(seed, 'AnchorA') },
    })
    expect(lastNotice(badAttachment)?.message).toMatch(/must reference a Attachment/)

    const noCollision = idOf(seed, 'NoCollisionConstraint')
    const badPart = apply(seed, {
      type: 'setProperty',
      id: noCollision,
      property: 'Part0',
      value: { type: 'Instance', value: idOf(seed, 'AttachmentA') },
    })
    expect(lastNotice(badPart)?.message).toMatch(/must reference a BasePart/)
  })

  it('only allows fixed-parent types under their required owner', () => {
    const seed = createSeedState()
    const level = idOf(seed, 'Level')
    const invalid = apply(seed, { type: 'createInstance', className: 'MaterialVariant', parentId: level })
    expect(lastNotice(invalid)?.message).toMatch(/must be parented to MaterialService/)
    const valid = apply(seed, {
      type: 'createInstance',
      className: 'MaterialVariant',
      parentId: idOf(seed, 'MaterialService'),
    })
    expect(valid.nodes[valid.selectedId!].className).toBe('MaterialVariant')
  })
})
