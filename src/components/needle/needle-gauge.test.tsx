import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { NeedleGauge } from './needle-gauge'

afterEach(cleanup)

describe('NeedleGauge', () => {
  it('renders the zone label in the zone color', () => {
    render(<NeedleGauge needle={{ progress: 0.5, zone: 'some_risk' }} />)
    expect(screen.getByText('some risk')).toHaveStyle({ color: '#E8B83C' })
  })
})
