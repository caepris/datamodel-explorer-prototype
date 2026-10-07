import { getDescendantIds, getFullName } from '../../model/tree'
import type { InstanceId } from '../../model/types'
import { useDataModel } from '../../state/useDataModel'
import { Modal } from '../Modal'

export function ConfirmDeleteDialog({ id, onClose }: { id: InstanceId; onClose: () => void }) {
  const { state, dispatch } = useDataModel()
  const node = state.nodes[id]
  if (!node) return null
  const descendants = getDescendantIds(state, id)

  return (
    <Modal title="Delete instance" onClose={onClose}>
      <p>
        Delete <code>{getFullName(state, id)}</code> and its {descendants.length} descendant
        {descendants.length === 1 ? '' : 's'}?
      </p>
      <ul className="delete-preview">
        {descendants.slice(0, 8).map((descendantId) => (
          <li key={descendantId}>
            {state.nodes[descendantId].name} <span className="muted">{state.nodes[descendantId].className}</span>
          </li>
        ))}
        {descendants.length > 8 && <li className="muted">…and {descendants.length - 8} more</li>}
      </ul>
      <p className="dialog-footnote">
        Destroying an instance destroys its whole subtree. References to anything removed are cleared.
      </p>
      <div className="dialog-actions">
        <button type="button" className="button" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="button button-danger"
          autoFocus
          onClick={() => {
            dispatch({ type: 'deleteInstance', id })
            onClose()
          }}
        >
          Delete
        </button>
      </div>
    </Modal>
  )
}
