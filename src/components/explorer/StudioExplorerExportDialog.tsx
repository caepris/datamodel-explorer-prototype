import { useEffect, useMemo, useState } from 'react'
import { buildStudioExplorerRows, studioExplorerTitle } from '../../model/studioExplorerSnapshot'
import { useDataModel } from '../../state/useDataModel'
import { Modal } from '../Modal'
import { renderStudioExplorerSnapshot } from './studioExplorerCanvas'

export function StudioExplorerExportDialog({ onClose }: { onClose: () => void }) {
  const { state } = useDataModel()
  const selectedId = state.selectedId && state.nodes[state.selectedId] ? state.selectedId : null
  const selected = selectedId ? state.nodes[selectedId] : null
  const rows = useMemo(() => buildStudioExplorerRows(state, selectedId), [state, selectedId])
  const title = studioExplorerTitle(selectedId)
  const [imageUrl, setImageUrl] = useState('')

  useEffect(() => {
    let active = true
    void renderStudioExplorerSnapshot(title, rows).then((canvas) => {
      if (active) setImageUrl(canvas.toDataURL('image/png'))
    })
    return () => {
      active = false
    }
  }, [rows, title])

  const download = () => {
    if (!imageUrl) return
    const link = document.createElement('a')
    link.href = imageUrl
    link.download = selected ? `Explorer - ${selected.name}.png` : 'Explorer.png'
    link.click()
  }

  return (
    <Modal title="Export Explorer" onClose={onClose}>
      <p className="dialog-subtitle">
        {selected
          ? `Studio-style snapshot of ${selected.name} and all its descendants.`
          : 'Studio-style snapshot of the entire DataModel.'}
      </p>
      <div className="property-export-frame explorer-export-frame">
        {imageUrl ? (
          <img className="property-export-preview explorer-export-preview" alt={title} src={imageUrl} />
        ) : (
          <p className="empty-hint">Preparing snapshot…</p>
        )}
      </div>
      <div className="property-export-actions">
        <button type="button" className="button" onClick={onClose}>
          Close
        </button>
        <button type="button" className="button button-primary" disabled={!imageUrl} onClick={download}>
          Download PNG
        </button>
      </div>
    </Modal>
  )
}
