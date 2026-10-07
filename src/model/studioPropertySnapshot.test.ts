import { describe, expect, it } from 'vitest'
import { dataModelReducer } from './dataModelReducer'
import { createSeedState } from './seed'
import { buildStudioPropertyRows, studioPropertyTitle } from './studioPropertySnapshot'

function spawnPad() {
  const state = createSeedState()
  const node = Object.values(state.nodes).find((item) => item.name === 'SpawnPad')
  if (!node) throw new Error('SpawnPad missing')
  return { state, node }
}

describe('studio property snapshot', () => {
  it('builds a Studio-style row list from the selected instance', () => {
    const { state, node } = spawnPad()
    expect(studioPropertyTitle(node.className, node.name)).toBe('Properties - Part "SpawnPad"')
    const rows = buildStudioPropertyRows(state, node)
    expect(rows[0]).toMatchObject({ kind: 'category', label: 'Data', arrow: 'down' })
    expect(rows.find((row) => row.label === 'Name')?.value).toEqual({ type: 'text', text: 'SpawnPad' })
    expect(rows.find((row) => row.label === 'Parent')?.value).toEqual({ type: 'text', text: 'Level' })
    expect(rows.find((row) => row.label === 'Anchored')?.value).toEqual({ type: 'check', checked: true })
    const color = rows.find((row) => row.label === 'Color')
    expect(color?.value.type).toBe('color')
    const cframe = rows.findIndex((row) => row.label === 'CFrame')
    expect(rows[cframe]).toMatchObject({ arrow: 'down', value: { type: 'none' } })
    expect(rows[cframe + 1]).toMatchObject({ label: 'Position', depth: 1, arrow: 'right' })
    expect(rows[cframe + 2]).toMatchObject({ label: 'Orientation', depth: 1, arrow: 'right' })
    expect(rows[cframe + 1]?.value).toEqual({ type: 'text', text: '0, 0.5, 0' })
  })

  it('includes customized properties for that class only', () => {
    const { state, node } = spawnPad()
    const customized = dataModelReducer(state, {
      type: 'addClassProperty',
      className: 'Part',
      property: {
        name: 'LaunchPower',
        category: 'Behavior',
        type: 'number',
        defaultValue: { type: 'number', value: 4 },
        children: [{ name: 'Overdrive', category: 'Behavior', type: 'bool', defaultValue: { type: 'bool', value: true } }],
      },
    })
    const rows = buildStudioPropertyRows(customized, customized.nodes[node.id])
    const launch = rows.findIndex((row) => row.label === 'LaunchPower')
    expect(rows[launch]).toMatchObject({ arrow: 'down', value: { type: 'text', text: '4' } })
    expect(rows[launch + 1]).toMatchObject({ label: 'Overdrive', depth: 1, value: { type: 'check', checked: true } })
    const head = Object.values(customized.nodes).find((item) => item.name === 'Head')
    expect(buildStudioPropertyRows(customized, head!).some((row) => row.label === 'LaunchPower')).toBe(false)
  })
})
