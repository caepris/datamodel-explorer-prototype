import { describe, expect, it } from 'vitest'
import { createSeedState } from './seed'
import { buildStudioExplorerRows } from './studioExplorerSnapshot'

describe('Studio Explorer snapshot', () => {
  it('exports the full DataModel when nothing is selected', () => {
    const state = createSeedState()
    const rows = buildStudioExplorerRows(state, null)
    expect(rows[0]).toMatchObject({ id: state.rootId, depth: 0 })
    expect(rows).toHaveLength(Object.keys(state.nodes).length)
    expect(rows.some((row) => row.name === 'Lighting')).toBe(true)
  })

  it('exports only a selected instance and its full descendant subtree', () => {
    const state = createSeedState()
    const level = Object.values(state.nodes).find((node) => node.name === 'Level')!
    const rows = buildStudioExplorerRows(state, level.id)

    expect(rows[0]).toMatchObject({ id: level.id, name: 'Level', depth: 0 })
    expect(rows.some((row) => row.name === 'Gate')).toBe(true)
    expect(rows.some((row) => row.name === 'Door')).toBe(true)
    expect(rows.some((row) => row.name === 'Lighting')).toBe(false)
    expect(rows.every((row) => row.id === level.id || row.depth > 0)).toBe(true)
  })
})
