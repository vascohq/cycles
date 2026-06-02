import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from '@testing-library/react'
import type { PaletteCycleItem, PalettePitchItem } from './types'

// cmdk relies on ResizeObserver and scrollIntoView, which jsdom doesn't provide.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub)
Element.prototype.scrollIntoView = vi.fn()

const pushMock = vi.fn()
const listCyclesMock = vi.fn<() => Promise<PaletteCycleItem[]>>()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('@/app/[slug]/cycles/actions', () => ({
  listCycles: () => listCyclesMock(),
}))

// Imported after the mocks so the context picks up the mocked server action.
const { CommandPaletteProvider, useRegisterPalettePitches } = await import(
  './command-palette-context'
)
const { CommandSearchButton } = await import('./command-search-button')

const CYCLES: PaletteCycleItem[] = [
  {
    slug: 'cycle-2',
    title: 'Autumn Cycle',
    type: 'build',
    start_date: '2026-09-01',
    end_date: '2026-10-13',
  },
  {
    slug: 'cooldown-1',
    title: 'Summer Cooldown',
    type: 'cooldown',
    start_date: '',
    end_date: '',
  },
]

const PITCHES: PalettePitchItem[] = [
  {
    id: 'p1',
    title: 'Command Palette',
    emoji: '',
    stage: 'building',
    zone: 'on_track',
    href: '/acme/cycles/cycle-2/command-palette',
  },
  {
    id: 'p2',
    title: 'Hill Trails',
    emoji: '',
    stage: 'shaping',
    zone: null,
    href: '/acme/cycles/cycle-2/hill-trails',
  },
]

function Registrar({ pitches }: { pitches: PalettePitchItem[] }) {
  useRegisterPalettePitches(pitches)
  return null
}

function setup(pitches: PalettePitchItem[] = []) {
  return render(
    <CommandPaletteProvider slug="acme">
      <CommandSearchButton />
      <Registrar pitches={pitches} />
    </CommandPaletteProvider>
  )
}

function openPalette() {
  fireEvent.click(screen.getByRole('button', { name: /search/i }))
}

beforeEach(() => {
  pushMock.mockReset()
  listCyclesMock.mockReset()
  listCyclesMock.mockResolvedValue(CYCLES)
})

afterEach(cleanup)

describe('CommandPalette', () => {
  it('does not fetch cycles until first opened', () => {
    setup()
    expect(listCyclesMock).not.toHaveBeenCalled()
  })

  it('lazily fetches and lists cycles on open', async () => {
    setup()
    openPalette()
    expect(await screen.findByText('Autumn Cycle')).toBeInTheDocument()
    expect(screen.getByText('Summer Cooldown')).toBeInTheDocument()
    expect(listCyclesMock).toHaveBeenCalledTimes(1)
  })

  it('fetches the cycle list only once across opens', async () => {
    setup()
    openPalette()
    await screen.findByText('Autumn Cycle')
    fireEvent.keyDown(document, { key: 'k', metaKey: true }) // close
    fireEvent.keyDown(document, { key: 'k', metaKey: true }) // reopen
    await screen.findByText('Autumn Cycle')
    expect(listCyclesMock).toHaveBeenCalledTimes(1)
  })

  it('navigates to Mission Control and closes when a cycle is chosen', async () => {
    setup()
    openPalette()
    fireEvent.click(await screen.findByText('Autumn Cycle'))
    expect(pushMock).toHaveBeenCalledWith('/acme/cycles/cycle-2')
    await waitFor(() =>
      expect(screen.queryByText('Autumn Cycle')).not.toBeInTheDocument()
    )
  })

  it('shows the marker on a cooldown cycle', async () => {
    setup()
    openPalette()
    await screen.findByText('Summer Cooldown')
    expect(screen.getByText('Cooldown')).toBeInTheDocument()
  })

  it('lists registered pitches with their stage and navigates to the Scope Map', async () => {
    setup(PITCHES)
    openPalette()
    expect(await screen.findByText('Command Palette')).toBeInTheDocument()
    expect(screen.getByText('Hill Trails')).toBeInTheDocument()
    expect(screen.getByText('building')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Command Palette'))
    expect(pushMock).toHaveBeenCalledWith('/acme/cycles/cycle-2/command-palette')
  })

  it('clears pitches from the palette when the room page unmounts', async () => {
    const { rerender } = setup(PITCHES)
    openPalette()
    await screen.findByText('Command Palette')

    rerender(
      <CommandPaletteProvider slug="acme">
        <CommandSearchButton />
        <Registrar pitches={[]} />
      </CommandPaletteProvider>
    )
    await waitFor(() =>
      expect(screen.queryByText('Command Palette')).not.toBeInTheDocument()
    )
  })

  it('filters items by query', async () => {
    setup(PITCHES)
    openPalette()
    await screen.findByText('Command Palette')
    fireEvent.change(screen.getByPlaceholderText(/search cycles and pitches/i), {
      target: { value: 'autumn' },
    })
    await waitFor(() =>
      expect(screen.queryByText('Command Palette')).not.toBeInTheDocument()
    )
    expect(screen.getByText('Autumn Cycle')).toBeInTheDocument()
  })
})
