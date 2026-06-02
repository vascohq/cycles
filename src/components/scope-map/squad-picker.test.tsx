import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { SquadPicker } from './squad-picker'

afterEach(cleanup)

const SQUADS = [
  { id: 's1', name: 'Platform', color: '#3e63dd' },
  { id: 's2', name: 'Growth', color: '#e5484d' },
  { id: 's3', name: 'Design', color: '#8e4ec6' },
]

function renderPicker(
  props: Partial<React.ComponentProps<typeof SquadPicker>> = {}
) {
  const handlers = {
    onAssign: vi.fn(),
    onClear: vi.fn(),
    onRenameSquad: vi.fn(),
    onRecolorSquad: vi.fn(),
    onDeleteSquad: vi.fn(),
  }
  render(
    <SquadPicker
      squads={SQUADS}
      currentSquadId="s1"
      pitchCounts={{ s2: 2 }}
      {...handlers}
      {...props}
    />
  )
  // Open the picker panel.
  fireEvent.click(screen.getByLabelText('Assign squad'))
  return handlers
}

describe('SquadPicker management', () => {
  it('renames a squad to a free name', () => {
    const { onRenameSquad } = renderPicker()
    fireEvent.click(screen.getByLabelText('Edit Growth'))
    const input = screen.getByDisplayValue('Growth')
    fireEvent.change(input, { target: { value: 'Growthers' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onRenameSquad).toHaveBeenCalledWith('s2', 'Growthers')
  })

  it('blocks a rename that collides with another squad and shows validation', () => {
    const { onRenameSquad } = renderPicker()
    fireEvent.click(screen.getByLabelText('Edit Growth'))
    const input = screen.getByDisplayValue('Growth')
    fireEvent.change(input, { target: { value: 'platform' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onRenameSquad).not.toHaveBeenCalled()
    expect(screen.getByText(/already exists/i)).toBeInTheDocument()
  })

  it('recolors a squad from the palette', () => {
    const { onRecolorSquad } = renderPicker()
    fireEvent.click(screen.getByLabelText('Edit Growth'))
    // Pick a palette swatch (green) different from Growth's current red.
    fireEvent.click(screen.getByLabelText('#30a46c'))
    expect(onRecolorSquad).toHaveBeenCalledWith('s2', '#30a46c')
  })

  it('deletes a squad behind a blast-radius confirm', () => {
    const { onDeleteSquad } = renderPicker()
    fireEvent.click(screen.getByLabelText('Delete Growth'))
    // Confirm copy states how many pitches move to Unassigned.
    expect(screen.getByText(/2 pitches → Unassigned/)).toBeInTheDocument()
    expect(onDeleteSquad).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Delete'))
    expect(onDeleteSquad).toHaveBeenCalledWith('s2')
  })
})
