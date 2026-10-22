import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { StageBadge } from './stage-badge'

afterEach(cleanup)

describe('StageBadge', () => {
  it('shows the current stage', () => {
    render(<StageBadge stage="building" onChange={vi.fn()} />)
    expect(screen.getByText('building')).toBeTruthy()
  })

  it('advances to the next stage when the forward arrow is clicked', () => {
    const onChange = vi.fn()
    render(<StageBadge stage="building" onChange={onChange} />)
    fireEvent.click(screen.getByLabelText('Advance to done'))
    expect(onChange).toHaveBeenCalledWith('done')
  })

  it('moves back to the previous stage when the back arrow is clicked', () => {
    const onChange = vi.fn()
    render(<StageBadge stage="done" onChange={onChange} />)
    fireEvent.click(screen.getByLabelText('Move back to building'))
    expect(onChange).toHaveBeenCalledWith('building')
  })

  it('offers no forward arrow once the pitch is done', () => {
    render(<StageBadge stage="done" onChange={vi.fn()} />)
    expect(screen.queryByLabelText(/Advance to/)).toBeNull()
  })

  it('offers no back arrow while still framing', () => {
    render(<StageBadge stage="framing" onChange={vi.fn()} />)
    expect(screen.queryByLabelText(/Move back to/)).toBeNull()
  })
})
