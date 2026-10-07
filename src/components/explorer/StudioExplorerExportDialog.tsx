import { useEffect, useMemo, useState } from 'react'
import { buildStudioExplorerRows, studioExplorerTitle } from '../../model/studioExplorerSnapshot'
import { useDataModel } from '../../state/useDataModel'
import { SnapshotExportActions } from '../SnapshotExportActions'
import { Modal } from '../Modal'
import { EXPLORER_SNAPSHOT_SCALE, renderStudioExplorerSnapshot } from './studioExplorerCanvas'

export function StudioExplorerExportDialog({ onClose }: { onClose: () => void }) {
  const { state } = useDataModel()
  const selectedId = state.selectedId && state.nodes[state.selectedId] ? state.selectedId : null
  const selected = selectedId ? state.nodes[selectedId] : null
  const rows = useMemo(() => buildStudioExplorerRows(state, selectedId), [state, selectedId])
  const title = studioExplorerTitle(selectedId)
  const [imageUrl, setImageUrl] = useState('')
  const [imageWidth, setImageWidth] = useState(0)

  useEffect(() => {
    let active = true
    void renderStudioExplorerSnapshot(rows, selected ? {} : { title }).then((canvas) => {
      if (!active) return
      setImageUrl(canvas.toDataURL('image/png'))
      setImageWidth(canvas.width / EXPLORER_SNAPSHOT_SCALE)
    })
    return () => {
      active = false
    }
  }, [rows, selected, title])

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
          ? `Fully expanded snapshot of ${selected.name} and all its descendants.`
          : 'Studio-style snapshot of the entire DataModel.'}
      </p>
      <div className="property-export-frame explorer-export-frame">
        {imageUrl ? (
          <img
            className="property-export-preview explorer-export-preview"
            alt={title}
            src={imageUrl}
            style={{ width: imageWidth }}
          />
        ) : (
          <p className="empty-hint">Preparing snapshot…</p>
        )}
      </div>
      <SnapshotExportActions imageUrl={imageUrl} onClose={onClose} onDownload={download} />
    </Modal>
  )
}
