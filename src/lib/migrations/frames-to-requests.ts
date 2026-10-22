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
  return renameKey(pitch, 'frame_id', 'request_id')
}

export function migrateCycleDocument<T extends Doc>(doc: T): Doc {
  if (!Array.isArray(doc.pitches)) return doc
  return { ...doc, pitches: (doc.pitches as Doc[]).map(migratePitch) }
}
