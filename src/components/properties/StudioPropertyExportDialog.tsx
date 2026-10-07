import { useMemo } from 'react'
import { buildStudioPropertyRows, studioPropertyTitle } from '../../model/studioPropertySnapshot'
import type { InstanceNode } from '../../model/types'
import { useDataModel } from '../../state/useDataModel'
import { Modal } from '../Modal'
import { renderStudioPropertySnapshot } from './studioPropertyCanvas'

export function StudioPropertyExportDialog({ node, onClose }: { node: InstanceNode; onClose: () => void }) {
  const { state } = useDataModel()
  const title = studioPropertyTitle(node.className, node.name)
  const imageUrl = useMemo(() => {
    const canvas = renderStudioPropertySnapshot(title, buildStudioPropertyRows(state, node))
    return canvas.toDataURL('image/png')
  }, [state, node, title])

  const download = () => {
    const link = document.createElement('a')
    link.href = imageUrl
    link.download = `${title}.png`
    link.click()
  }

  return (
    <Modal title="Export properties" onClose={onClose}>
      <p className="dialog-subtitle">Studio-style snapshot of {node.className} "{node.name}".</p>
      <div className="property-export-frame">
        <img className="property-export-preview" alt={title} src={imageUrl} />
      </div>
      <div className="property-export-actions">
        <button type="button" className="button" onClick={onClose}>
          Close
        </button>
        <button type="button" className="button button-primary" onClick={download}>
          Download PNG
        </button>
      </div>
    </Modal>
  )
}
