import { describe, it, expect } from 'vitest'
import { clusterTimeOff } from './time-off-clustering'
import type { OverlayBand } from './ics-normalizer'

const off = (summary: string, startDate: string, endDate: string): OverlayBand => ({
  kind: 'timeoff',
  label: 'Humi',
  summary,
  startDate,
  endDate,
})

describe('clusterTimeOff', () => {
  it('merges two overlapping absences into one cluster spanning their union', () => {
    const clusters = clusterTimeOff([
      off('Laura', '2026-06-24', '2026-06-26'),
      off('Xavier', '2026-06-25', '2026-06-30'),
    ])

    expect(clusters).toHaveLength(1)
    expect(clusters[0]).toMatchObject({
      startDate: '2026-06-24',
      endDate: '2026-06-30',
    })
    expect(clusters[0]?.members.map((m) => m.summary)).toEqual(['Laura', 'Xavier'])
  })

  it('keeps disjoint absences as separate clusters', () => {
    const clusters = clusterTimeOff([
      off('Alice', '2026-06-01', '2026-06-03'),
      off('Bob', '2026-06-10', '2026-06-12'),
    ])

    expect(clusters).toHaveLength(2)
    expect(clusters.map((c) => c.members.length)).toEqual([1, 1])
  })

  it('does not merge absences that are merely adjacent (no shared day)', () => {
    const clusters = clusterTimeOff([
      off('Alice', '2026-06-05', '2026-06-08'),
      off('Bob', '2026-06-09', '2026-06-11'),
    ])

    expect(clusters).toHaveLength(2)
  })

  it('chains transitively overlapping absences into one cluster', () => {
    // A–B overlap, B–C overlap, but A and C do not overlap directly.
    const clusters = clusterTimeOff([
      off('A', '2026-06-01', '2026-06-05'),
      off('C', '2026-06-07', '2026-06-10'),
      off('B', '2026-06-04', '2026-06-08'),
    ])

    expect(clusters).toHaveLength(1)
    expect(clusters[0]).toMatchObject({ startDate: '2026-06-01', endDate: '2026-06-10' })
    expect(clusters[0]?.members).toHaveLength(3)
  })
})
