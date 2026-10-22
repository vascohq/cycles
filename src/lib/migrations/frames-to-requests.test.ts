import { describe, it, expect } from 'vitest'
import { migrateProductMapDocument, migrateCycleDocument } from './frames-to-requests'

const oldProductMap = {
  areas: [{ id: 'a1', name: 'Billing', x: 0, y: 0 }],
  frames: [
    {
      id: 'f1',
      areaId: 'a1',
      kind: 'pain_point',
      type: 'request',
      problem: 'Exports time out',
      appetite: '2 weeks',
      business_case: '',
      originFrameId: 'f0',
      related_frame_ids: ['f2'],
      reports: [],
      pointers: [],
      outcomes: [{ id: 'o1', text: 'An export of a year finishes' }],
      last_woken: '2026-10-01',
      resolved: false,
    },
    {
      id: 'f2',
      kind: 'brand_burn',
      type: 'bug',
      problem: 'Login loops',
      appetite: '',
      business_case: '',
      reports: [],
      pointers: [],
      outcomes: [],
      last_woken: '2026-10-02',
      resolved: false,
    },
  ],
}

describe('migrating a Product Map room from frames to requests', () => {
  it('moves every frame to the requests list and renames the frame links', () => {
    const migrated = migrateProductMapDocument(oldProductMap)

    expect(migrated).not.toHaveProperty('frames')
    expect(migrated.areas).toEqual(oldProductMap.areas)
    expect(migrated.requests).toEqual([
      {
        id: 'f1',
        areaId: 'a1',
        kind: 'pain_point',
        type: 'ask',
        problem: 'Exports time out',
        appetite: '2 weeks',
        business_case: '',
        originRequestId: 'f0',
        related_request_ids: ['f2'],
        reports: [],
        pointers: [],
        outcomes: [{ id: 'o1', text: 'An export of a year finishes' }],
        last_woken: '2026-10-01',
        resolved: false,
      },
      oldProductMap.frames[1],
    ])
  })

  it('leaves an already migrated room unchanged', () => {
    const once = migrateProductMapDocument(oldProductMap)
    expect(migrateProductMapDocument(once)).toEqual(once)
  })

  // Between the deploy and the migration, the app and the MCP can already
  // write to a new `requests` list. Those requests must survive.
  it('keeps the requests written before the migration ran', () => {
    const captured = { ...oldProductMap.frames[1], id: 'r-new', type: 'bug' }
    const mixed = { ...oldProductMap, requests: [captured] }

    const migrated = migrateProductMapDocument(mixed)

    expect((migrated.requests as { id: string }[]).map((r) => r.id)).toEqual(['f1', 'f2', 'r-new'])
    expect(migrated).not.toHaveProperty('frames')
  })

  it('leaves a room that never held a frame unchanged', () => {
    const empty = { areas: [] }
    expect(migrateProductMapDocument(empty)).toEqual(empty)
  })
})

describe('migrating a cycle room from frames to requests', () => {
  const oldCycle = {
    cycle: { name: 'Cycle 12' },
    pitches: [
      { id: 'p1', title: 'Fast exports', frame_problem: 'Exports time out', frame_outcome: 'A year exports', frame_id: 'f1' },
      { id: 'p2', title: 'No frame', frame_problem: '', frame_outcome: '' },
      { id: 'p3', title: 'Renamed once', frame_problem: '', frame_outcome: '', request_id: 'f3' },
    ],
    scopes: [{ id: 's1', pitchId: 'p1' }],
  }

  it('points each pitch at its list of requests and turns its outcome into a list', () => {
    const migrated = migrateCycleDocument(oldCycle)

    expect(migrated.pitches).toEqual([
      {
        id: 'p1',
        title: 'Fast exports',
        frame_problem: 'Exports time out',
        frame_outcomes: [{ id: 'p1-outcome', text: 'A year exports' }],
        request_ids: ['f1'],
      },
      { id: 'p2', title: 'No frame', frame_problem: '', frame_outcomes: [] },
      { id: 'p3', title: 'Renamed once', frame_problem: '', frame_outcomes: [], request_ids: ['f3'] },
    ])
    expect(migrated.cycle).toEqual(oldCycle.cycle)
    expect(migrated.scopes).toEqual(oldCycle.scopes)
  })

  it('leaves an already migrated room unchanged', () => {
    const once = migrateCycleDocument(oldCycle)
    expect(migrateCycleDocument(once)).toEqual(once)
  })
})
