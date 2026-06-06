import { describe, it, expect } from 'vitest'
import { STAGES, nextStage, prevStage, stageAfterNeedle } from './stage-engine'

describe('STAGES', () => {
  it('runs framing → shaping → building → done', () => {
    expect(STAGES).toEqual(['framing', 'shaping', 'building', 'done'])
  })
})

describe('nextStage', () => {
  it('advances one step forward', () => {
    expect(nextStage('framing')).toBe('shaping')
    expect(nextStage('shaping')).toBe('building')
    expect(nextStage('building')).toBe('done')
  })

  it('returns null when already at the last stage', () => {
    expect(nextStage('done')).toBeNull()
  })
})

describe('prevStage', () => {
  it('steps one stage backward', () => {
    expect(prevStage('done')).toBe('building')
    expect(prevStage('shaping')).toBe('framing')
  })

  it('returns null when already at the first stage', () => {
    expect(prevStage('framing')).toBeNull()
  })
})

describe('stageAfterNeedle', () => {
  it('flips the stage to done once the needle reaches 100%', () => {
    expect(stageAfterNeedle(1, 'building')).toBe('done')
    expect(stageAfterNeedle(1, 'framing')).toBe('done')
  })

  it('leaves the stage unchanged below 100%', () => {
    expect(stageAfterNeedle(0.92, 'building')).toBe('building')
    expect(stageAfterNeedle(0, 'framing')).toBe('framing')
  })

  it('leaves an already-done pitch done', () => {
    expect(stageAfterNeedle(1, 'done')).toBe('done')
  })
})
