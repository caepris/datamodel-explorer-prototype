import { useState } from 'react'
import { copyPngDataUrl } from './copySnapshotImage'

export function SnapshotExportActions({
  imageUrl,
  onClose,
  onDownload,
}: {
  imageUrl: string
  onClose: () => void
  onDownload: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  const copy = async () => {
    setError('')
    try {
      await copyPngDataUrl(imageUrl)
      setCopied(true)
    } catch {
      setCopied(false)
      setError('Could not copy the image. Download the PNG instead.')
    }
  }

  return (
    <>
      {error && <p className="dialog-error">{error}</p>}
      <div className="property-export-actions">
        <button type="button" className="button" onClick={onClose}>
          Close
        </button>
        <button type="button" className="button" disabled={!imageUrl} onClick={() => void copy()}>
          {copied ? 'Copied' : 'Copy image'}
        </button>
        <button type="button" className="button button-primary" disabled={!imageUrl} onClick={onDownload}>
          Download PNG
        </button>
      </div>
    </>
  )
}
