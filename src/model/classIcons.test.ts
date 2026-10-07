import { describe, expect, it } from 'vitest'
import { classImageIndex } from './classIcons'

describe('Studio class icons', () => {
  it('uses ExplorerImageIndex values from Studio', () => {
    expect(classImageIndex('Part')).toBe(1)
    expect(classImageIndex('Model')).toBe(2)
    expect(classImageIndex('Script')).toBe(6)
    expect(classImageIndex('Workspace')).toBe(19)
    expect(classImageIndex('Terrain')).toBe(65)
    expect(classImageIndex('MeshPart')).toBe(73)
    expect(classImageIndex('Folder')).toBe(77)
    expect(classImageIndex('NegateOperation')).toBe(72)
    expect(classImageIndex('DataModel')).toBe(0)
  })
})
