import { useCallback, useRef, useState, type PointerEvent } from 'react'
import { ExplorerPanel } from './components/explorer/ExplorerPanel'
import { PropertiesPanel } from './components/properties/PropertiesPanel'
import { Toasts } from './components/Toasts'
import { Walkthrough } from './components/Walkthrough'
import { useDataModel } from './state/useDataModel'
import './App.css'

const MIN_PANE_WIDTH = 220

export default function App() {
  const { state, dispatch } = useDataModel()
  const [explorerWidth, setExplorerWidth] = useState(340)
  const [showWalkthrough, setShowWalkthrough] = useState(true)
  const dragStart = useRef<{ x: number; width: number } | null>(null)

  const onResizeStart = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    dragStart.current = { x: event.clientX, width: explorerWidth }
  }
  const onResizeMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return
    const next = dragStart.current.width + event.clientX - dragStart.current.x
    setExplorerWidth(Math.min(window.innerWidth - MIN_PANE_WIDTH * 2, Math.max(MIN_PANE_WIDTH, next)))
  }, [])

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-title">
          <span className="topbar-logo" aria-hidden="true">
            ◆
          </span>
          <h1>DataModel Explorer</h1>
          <span className="topbar-tag">Visual prototype</span>
        </div>
        <div className="topbar-meta">
          <span>{Object.keys(state.nodes).length} instances</span>
        </div>
        <div className="topbar-actions">
          <button type="button" className="button" onClick={() => setShowWalkthrough((s) => !s)}>
            {showWalkthrough ? 'Hide walkthrough' : 'Walkthrough'}
          </button>
          <button type="button" className="button" onClick={() => dispatch({ type: 'reset' })}>
            Reset demo
          </button>
        </div>
      </header>
      <main className="workspace-layout">
        <div className="pane" style={{ width: explorerWidth }}>
          <ExplorerPanel />
        </div>
        <div
          className="resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize Explorer"
          onPointerDown={onResizeStart}
          onPointerMove={onResizeMove}
          onPointerUp={() => (dragStart.current = null)}
        />
        <div className="pane pane-fill">
          <PropertiesPanel />
        </div>
        {showWalkthrough && <Walkthrough onClose={() => setShowWalkthrough(false)} />}
      </main>
      <Toasts />
    </div>
  )
}
