import { useEffect } from 'react'
import type { Notice } from '../model/types'
import { useDataModel } from '../state/useDataModel'

const TOAST_DURATION_MS = 6000

function Toast({ notice }: { notice: Notice }) {
  const { dispatch } = useDataModel()
  useEffect(() => {
    const timer = window.setTimeout(() => dispatch({ type: 'dismissNotice', noticeId: notice.id }), TOAST_DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [dispatch, notice.id])

  return (
    <div className={`toast toast-${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
      <span className="toast-label">{notice.kind === 'error' ? 'Rejected' : 'Note'}</span>
      <span className="toast-message">{notice.message}</span>
      <button
        type="button"
        className="icon-button"
        aria-label="Dismiss"
        onClick={() => dispatch({ type: 'dismissNotice', noticeId: notice.id })}
      >
        ×
      </button>
    </div>
  )
}

export function Toasts() {
  const { state } = useDataModel()
  return (
    <div className="toasts" aria-live="polite">
      {state.notices.map((notice) => (
        <Toast key={notice.id} notice={notice} />
      ))}
    </div>
  )
}
