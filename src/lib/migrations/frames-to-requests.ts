// One-off migration for the Frame → Request rename (spec #282). Pure functions
// over a storage document, so the fixtures prove them before any room is
// touched. Each one returns an already migrated document unchanged, so a failed
// run can restart. Delete this module once every room has been migrated.

type Doc = Record<string, unknown>

function renameKey(obj: Doc, from: string, to: string): Doc {
  if (!(from in obj)) return obj
  const { [from]: value, ...rest } = obj
  return { ...rest, [to]: value }
}

export function migrateRequest(frame: Doc): Doc {
  let request = renameKey(frame, 'originFrameId', 'originRequestId')
  request = renameKey(request, 'related_frame_ids', 'related_request_ids')
  return request.type === 'request' ? { ...request, type: 'ask' } : request
}

export function migrateProductMapDocument<T extends Doc>(doc: T): Doc {
  if (!Array.isArray(doc.frames)) return doc
  const { frames, requests, ...rest } = doc
  // Requests written to the new list after the deploy stay, after the frames.
  const written = Array.isArray(requests) ? (requests as Doc[]) : []
  return { ...rest, requests: [...(frames as Doc[]).map(migrateRequest), ...written] }
}

export function migratePitch(pitch: Doc): Doc {
  const { frame_id, request_id, frame_outcome, ...rest } = pitch
  const next: Doc = { ...rest }
  // A pitch carries many requests (ADR 0032). Rooms hold either the name from
  // before the rename (frame_id) or the one from the rename itself (request_id).
  const single = frame_id ?? request_id
  if (typeof single === 'string' && single) next.request_ids = [single]
  // The free-text outcome becomes a list. A fixed id keeps a rerun a no-op.
  if (typeof frame_outcome === 'string') {
    next.frame_outcomes = frame_outcome.trim()
      ? [{ id: `${pitch.id}-outcome`, text: frame_outcome.trim() }]
      : []
  }
  return next
}

export function migrateCycleDocument<T extends Doc>(doc: T): Doc {
  if (!Array.isArray(doc.pitches)) return doc
  return { ...doc, pitches: (doc.pitches as Doc[]).map(migratePitch) }
}
