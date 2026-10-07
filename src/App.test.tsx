import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { DataModelProvider } from './state/DataModelContext'

function renderApp() {
  const user = userEvent.setup()
  render(
    <DataModelProvider>
      <App />
    </DataModelProvider>,
  )
  return { user, tree: screen.getByRole('tree', { name: 'DataModel tree' }) }
}

const row = (tree: HTMLElement, name: string) =>
  within(tree)
    .getAllByRole('treeitem')
    .find((item) => item.querySelector('.tree-row-name')?.textContent === name)!

const properties = () => screen.getByRole('region', { name: 'Properties' })

describe('Explorer and Properties', () => {
  it('shows properties for the selected instance', async () => {
    const { user, tree } = renderApp()
    expect(within(properties()).getByRole('textbox', { name: 'Name' })).toHaveValue('SpawnPad')

    await user.click(row(tree, 'Lighting'))
    const panel = properties()
    expect(within(panel).getByRole('textbox', { name: 'Name' })).toHaveValue('Lighting')
    expect(within(panel).getByRole('region', { name: 'Fog properties' })).toBeInTheDocument()
    const parent = within(panel).getByLabelText('Parent (read-only)')
    expect(parent).toHaveTextContent('Obby Prototype')
    expect(parent).toHaveAttribute('title', 'Services have a locked Parent.')
  })

  it('edits typed properties', async () => {
    const { user } = renderApp()
    const panel = properties()

    await user.click(within(panel).getByRole('checkbox', { name: 'Anchored' }))
    expect(within(panel).getByRole('checkbox', { name: 'Anchored' })).not.toBeChecked()

    await user.selectOptions(within(panel).getByRole('combobox', { name: 'Material' }), 'Neon')
    expect(within(panel).getByRole('combobox', { name: 'Material' })).toHaveValue('Neon')

    const sizeX = within(panel).getByRole('textbox', { name: 'Size X' })
    await user.clear(sizeX)
    await user.type(sizeX, '12{Enter}')
    expect(within(panel).getByRole('textbox', { name: 'Size X' })).toHaveValue('12')
    expect(within(panel).getByLabelText('AssemblyMass (read-only)')).toHaveTextContent('67.2')
  })

  it('renames from the Name property and updates the tree', async () => {
    const { user, tree } = renderApp()
    const name = within(properties()).getByRole('textbox', { name: 'Name' })
    await user.clear(name)
    await user.type(name, 'StartPad{Enter}')
    expect(row(tree, 'StartPad')).toBeDefined()
  })

  it('shows a rejection when an invalid number is entered', async () => {
    const { user } = renderApp()
    const field = within(properties()).getByRole('textbox', { name: 'Transparency' })
    await user.clear(field)
    await user.type(field, 'abc{Enter}')
    expect(await screen.findByRole('alert')).toHaveTextContent(/finite number/)
    expect(within(properties()).getByRole('textbox', { name: 'Transparency' })).toHaveValue('0')
  })

  it('inserts a new instance under the selection', async () => {
    const { user, tree } = renderApp()
    await user.click(row(tree, 'Level'))
    await user.click(screen.getByRole('button', { name: 'Insert Object' }))
    const dialog = screen.getByRole('dialog', { name: 'Insert Object' })
    expect(within(dialog).queryByText('BasePart')).toBeNull()
    await user.type(within(dialog).getByRole('textbox', { name: 'Search classes' }), 'Folder')
    await user.click(within(dialog).getByRole('option', { name: /Folder/ }))

    expect(screen.queryByRole('dialog')).toBeNull()
    const created = row(tree, 'Folder')
    expect(created).toHaveAttribute('aria-selected', 'true')
    expect(created).toHaveAttribute('aria-level', '4')
  })

  it('confirms before deleting a subtree', async () => {
    const { user, tree } = renderApp()
    await user.click(row(tree, 'Gate'))
    fireEvent.keyDown(tree, { key: 'Delete' })
    const dialog = screen.getByRole('dialog', { name: 'Delete instance' })
    expect(dialog).toHaveTextContent('2 descendants')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(row(tree, 'Gate')).toBeUndefined()
  })

  it('deletes a leaf immediately and rejects deleting a service', async () => {
    const { user, tree } = renderApp()
    fireEvent.keyDown(tree, { key: 'Delete' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(row(tree, 'SpawnPad')).toBeUndefined()

    await user.click(row(tree, 'Workspace'))
    fireEvent.keyDown(tree, { key: 'Delete' })
    expect(await screen.findByRole('alert')).toHaveTextContent(/protected and cannot be deleted/)
  })

  it('filters the tree by name or class', async () => {
    const { user, tree } = renderApp()
    await user.type(screen.getByRole('textbox', { name: 'Filter Explorer' }), 'ModuleScript')
    const names = within(tree)
      .getAllByRole('treeitem')
      .map((item) => item.querySelector('.tree-row-name')?.textContent)
    expect(names).toEqual(['Obby Prototype', 'ReplicatedStorage', 'Shared', 'GateConfig'])
  })

  it('renames inline with F2', async () => {
    const { user, tree } = renderApp()
    fireEvent.keyDown(tree, { key: 'F2' })
    const input = screen.getByRole('textbox', { name: 'Rename SpawnPad' })
    await user.clear(input)
    await user.type(input, 'Checkpoint1{Enter}')
    expect(row(tree, 'Checkpoint1')).toHaveAttribute('aria-selected', 'true')
  })

  it('reparents through drag and drop and rejects cycles', () => {
    const { tree } = renderApp()
    fireEvent.click(row(tree, 'Gate').querySelector('.tree-chevron')!)
    fireEvent.dragStart(row(tree, 'Door'), { dataTransfer: { setData: () => {}, effectAllowed: '' } })
    fireEvent.drop(row(tree, 'Workspace'))
    expect(row(tree, 'Door')).toHaveAttribute('aria-level', '3')
    expect(screen.getByRole('status')).toHaveTextContent(/Gate\.PrimaryPart/)

    fireEvent.dragStart(row(tree, 'Level'), { dataTransfer: { setData: () => {}, effectAllowed: '' } })
    fireEvent.drop(row(tree, 'SpawnPad'))
    expect(screen.getByRole('alert')).toHaveTextContent(/circular reference/)
  })

  it('adds, edits, and removes attributes', async () => {
    const { user } = renderApp()
    const attributes = within(properties()).getByRole('region', { name: 'Attributes' })

    await user.click(within(attributes).getByRole('button', { name: 'Add attribute' }))
    await user.type(within(attributes).getByRole('textbox', { name: 'New attribute name' }), 'RBXHidden')
    await user.click(within(attributes).getByRole('button', { name: 'Add' }))
    expect(within(attributes).getByRole('alert')).toHaveTextContent(/reserved/)

    const nameInput = within(attributes).getByRole('textbox', { name: 'New attribute name' })
    await user.clear(nameInput)
    await user.type(nameInput, 'Bounciness')
    await user.selectOptions(within(attributes).getByRole('combobox', { name: 'New attribute type' }), 'number')
    await user.click(within(attributes).getByRole('button', { name: 'Add' }))

    const value = within(attributes).getByRole('textbox', { name: 'Attribute Bounciness' })
    await user.clear(value)
    await user.type(value, '0.5{Enter}')
    expect(within(attributes).getByRole('textbox', { name: 'Attribute Bounciness' })).toHaveValue('0.5')

    await user.click(within(attributes).getByRole('button', { name: 'Remove attribute Bounciness' }))
    expect(within(attributes).queryByRole('textbox', { name: 'Attribute Bounciness' })).toBeNull()
  })

  it('filters properties by name and hides non-public ones', async () => {
    const { user } = renderApp()
    const panel = properties()
    expect(within(panel).queryByText('RobloxLocked')).toBeNull()
    await user.type(within(panel).getByRole('textbox', { name: 'Filter properties' }), 'can')
    const names = [...panel.querySelectorAll('.property-name')].map((el) => el.textContent)
    expect(names).toEqual(['CanCollide', 'CanTouch', 'CanQuery'])
  })

  it('restores the seed with Reset demo', async () => {
    const { user, tree } = renderApp()
    fireEvent.keyDown(tree, { key: 'Delete' })
    expect(row(tree, 'SpawnPad')).toBeUndefined()
    await user.click(screen.getByRole('button', { name: 'Reset demo' }))
    expect(row(tree, 'SpawnPad')).toBeDefined()
  })

  it('bulk adds several properties from one list', async () => {
    const { user } = renderApp()
    const panel = properties()
    await user.click(within(panel).getByRole('button', { name: 'Customize' }))
    await user.click(within(panel).getByRole('button', { name: 'Bulk add' }))
    const dialog = screen.getByRole('dialog', { name: 'Bulk add Part properties' })
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Bulk properties' }), {
      target: { value: 'LaunchPower number @Product\nLaunchReady bool @Product gates\n  RetryCount number' },
    })
    await user.click(within(dialog).getByRole('button', { name: 'Add 3 properties' }))
    expect(within(panel).getByRole('textbox', { name: 'LaunchPower' })).toHaveValue('0')
    expect(within(panel).getByRole('checkbox', { name: 'LaunchReady' })).not.toBeChecked()
    expect(within(panel).getByRole('textbox', { name: 'RetryCount' })).toBeDisabled()
  })

  it('customizes the property panel for an instance class', async () => {
    const { user } = renderApp()
    const panel = properties()
    await user.click(within(panel).getByRole('button', { name: 'Customize' }))
    expect(within(panel).getByText('Editing Part')).toBeInTheDocument()

    await user.click(within(panel).getByRole('button', { name: /Add property/ }))
    const dialog = screen.getByRole('dialog', { name: 'Add Part property' })
    await user.type(within(dialog).getByRole('textbox', { name: 'Property name' }), 'LaunchState')
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Property type' }), 'enum')
    const options = within(dialog).getByRole('textbox', { name: 'Enum options' })
    await user.clear(options)
    await user.type(options, 'Draft, Ready, Shipped')
    const category = within(dialog).getByRole('combobox', { name: 'Property category' })
    await user.clear(category)
    await user.type(category, 'Product')
    await user.click(within(dialog).getByRole('button', { name: 'Add property' }))

    expect(within(panel).getByRole('region', { name: 'Product properties' })).toBeInTheDocument()
    expect(within(panel).getByRole('combobox', { name: 'LaunchState' })).toHaveValue('Draft')

    await user.click(within(panel).getByRole('button', { name: 'Edit property LaunchState' }))
    const editDialog = screen.getByRole('dialog', { name: 'Edit Part property' })
    expect(within(editDialog).getByRole('textbox', { name: 'Property name' })).toBeEnabled()
    await user.click(within(editDialog).getByRole('button', { name: 'Cancel' }))

    await user.click(within(panel).getByRole('button', { name: 'Delete property LaunchState' }))
    expect(within(panel).queryByRole('combobox', { name: 'LaunchState' })).toBeNull()
  })

  it('creates nested properties and gates descendant editors with a boolean parent', async () => {
    const { user } = renderApp()
    const panel = properties()
    await user.click(within(panel).getByRole('button', { name: 'Customize' }))
    await user.click(within(panel).getByRole('button', { name: '+ Add property' }))

    const parentDialog = screen.getByRole('dialog', { name: 'Add Part property' })
    await user.type(within(parentDialog).getByRole('textbox', { name: 'Property name' }), 'FeatureEnabled')
    await user.selectOptions(within(parentDialog).getByRole('combobox', { name: 'Property type' }), 'bool')
    await user.click(within(parentDialog).getByRole('checkbox', { name: 'Use this checkbox to enable subproperties' }))
    await user.click(within(parentDialog).getByRole('button', { name: 'Add property' }))

    await user.click(within(panel).getByRole('button', { name: 'Add subproperty to FeatureEnabled' }))
    const childDialog = screen.getByRole('dialog', { name: 'Add Part subproperty' })
    await user.type(within(childDialog).getByRole('textbox', { name: 'Property name' }), 'RetryCount')
    await user.selectOptions(within(childDialog).getByRole('combobox', { name: 'Property type' }), 'number')
    expect(within(childDialog).getByRole('combobox', { name: 'Property category' })).toBeDisabled()
    await user.click(within(childDialog).getByRole('button', { name: 'Add property' }))

    const parent = within(panel).getByRole('checkbox', { name: 'FeatureEnabled' })
    let child = within(panel).getByRole('textbox', { name: 'RetryCount' })
    expect(parent).not.toBeChecked()
    expect(child).toBeDisabled()

    await user.click(parent)
    child = within(panel).getByRole('textbox', { name: 'RetryCount' })
    expect(child).toBeEnabled()
    await user.clear(child)
    await user.type(child, '7{Enter}')
    await user.click(parent)
    expect(within(panel).getByRole('textbox', { name: 'RetryCount' })).toBeDisabled()
    await user.click(parent)
    expect(within(panel).getByRole('textbox', { name: 'RetryCount' })).toHaveValue('7')

    await user.click(within(panel).getByRole('button', { name: 'Collapse FeatureEnabled subproperties' }))
    expect(within(panel).queryByRole('textbox', { name: 'RetryCount' })).toBeNull()
    await user.type(within(panel).getByRole('textbox', { name: 'Filter properties' }), 'RetryCount')
    expect(within(panel).getByRole('textbox', { name: 'RetryCount' })).toHaveValue('7')

    await user.clear(within(panel).getByRole('textbox', { name: 'Filter properties' }))
    await user.click(within(panel).getByRole('button', { name: 'Expand FeatureEnabled subproperties' }))
    const feature = panel.querySelector('[data-property="FeatureEnabled"]') as HTMLElement
    const retry = panel.querySelector('[data-property="FeatureEnabled.RetryCount"]') as HTMLElement
    const dataTransfer = { setData: () => {}, effectAllowed: 'move', dropEffect: 'move' }
    fireEvent.dragStart(retry.querySelector('.property-drag-handle')!, { dataTransfer })
    fireEvent.dragOver(feature, { dataTransfer, clientY: feature.getBoundingClientRect().top })
    fireEvent.drop(feature, { dataTransfer })
    const names = [...panel.querySelectorAll('[data-property]')].map((element) => element.getAttribute('data-property'))
    expect(names.indexOf('RetryCount')).toBeGreaterThan(-1)
    expect(names.indexOf('RetryCount')).toBeLessThan(names.indexOf('FeatureEnabled'))

    await user.click(within(panel).getByRole('button', { name: 'Delete property RetryCount' }))
    await user.click(within(panel).getByRole('button', { name: 'Delete property FeatureEnabled' }))
    expect(within(panel).queryByRole('checkbox', { name: 'FeatureEnabled' })).toBeNull()
    expect(within(panel).queryByRole('textbox', { name: 'RetryCount' })).toBeNull()
  }, 20000)
})
