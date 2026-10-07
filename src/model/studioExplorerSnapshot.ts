import type { DataModelState, InstanceId } from './types'

export interface StudioExplorerRow {
  id: InstanceId
  name: string
  className: string
  depth: number
  hasChildren: boolean
}

export function buildStudioExplorerRows(state: DataModelState, selectedId: InstanceId | null): StudioExplorerRow[] {
  const rootId = selectedId && state.nodes[selectedId] ? selectedId : state.rootId
  const rows: StudioExplorerRow[] = []

  const visit = (id: InstanceId, depth: number) => {
    const node = state.nodes[id]
    if (!node) return
    rows.push({
      id,
      name: node.name,
      className: node.className,
      depth,
      hasChildren: node.children.length > 0,
    })
    for (const childId of node.children) visit(childId, depth + 1)
  }

  visit(rootId, 0)
  return rows
}

export function studioExplorerTitle(selectedId: InstanceId | null): string {
  return selectedId ? 'Explorer Selection' : 'Explorer'
}
