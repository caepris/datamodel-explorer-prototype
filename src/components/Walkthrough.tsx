const STEPS: { title: string; detail: string }[] = [
  {
    title: 'Read the tree',
    detail:
      'Every object is an Instance with exactly one Parent. The DataModel ("game") is the root and its direct children are services such as Workspace and Lighting.',
  },
  {
    title: 'Add an instance',
    detail:
      'Hover a row and press +, or press Ctrl+I. Only concrete, creatable classes are offered; abstract classes like BasePart and services are not.',
  },
  {
    title: 'Reparent by dragging',
    detail:
      'Drag Door out of Gate into Level. Gate.PrimaryPart is cleared because a model’s PrimaryPart must live inside it. Try dragging Level onto SpawnPad or moving a service to see rejections.',
  },
  {
    title: 'Edit or customize properties',
    detail:
      'Edit instance values normally, or press Customize to add, edit, delete, duplicate, and drag fields on the selected class. Export downloads a Studio-style snapshot of the selected instance. Duplicate copies a field and its subproperties. Bulk add creates many fields at once. Dragging can reorder a field, move it to another category, or nest it. Class changes update every existing and future instance and flow to subclasses.',
  },
  {
    title: 'Add and remove attributes',
    detail:
      'Attributes are the custom, per-instance data that creators can add, rename, retype, and remove. Names allow letters, digits, and underscores, and cannot start with "RBX".',
  },
  {
    title: 'Delete a subtree',
    detail:
      'Delete Gate (Delete key or right-click). Its descendants go with it and any references to them, like GateTarget.Value, are cleared. Use Reset demo to start over.',
  },
]

export function Walkthrough({ onClose }: { onClose: () => void }) {
  return (
    <aside className="walkthrough" aria-label="Walkthrough">
      <header className="panel-header">
        <h2>PM walkthrough</h2>
        <button type="button" className="icon-button" aria-label="Close walkthrough" onClick={onClose}>
          ×
        </button>
      </header>
      <ol className="walkthrough-steps">
        {STEPS.map((step) => (
          <li key={step.title}>
            <strong>{step.title}</strong>
            <p>{step.detail}</p>
          </li>
        ))}
      </ol>
      <p className="walkthrough-footnote">
        This is a visual prototype. Nothing runs: no physics, rendering, scripts, replication, or saving. All changes live
        in browser memory.
      </p>
    </aside>
  )
}
