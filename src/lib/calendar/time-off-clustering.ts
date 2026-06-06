import type { OverlayBand } from './ics-normalizer'

export type TimeOffMember = {
  summary: string
  startDate: string
  endDate: string
}

export type TimeOffCluster = {
  kind: 'timeoff'
  label: string
  startDate: string
  endDate: string
  members: TimeOffMember[]
}

/**
 * Merge Time Off bands that overlap in time into clusters, so a day with
 * several people away renders as one band whose tooltip can list everyone
 * (rather than independent bands stacking and burying each other's hover).
 * Two bands belong to the same cluster when their inclusive date ranges share
 * at least one day; overlap is transitive (A–B and B–C chain A–C together).
 */
export function clusterTimeOff(bands: OverlayBand[]): TimeOffCluster[] {
  const sorted = [...bands].sort((a, b) => a.startDate.localeCompare(b.startDate))
  const clusters: TimeOffCluster[] = []

  for (const band of sorted) {
    const member: TimeOffMember = {
      summary: band.summary,
      startDate: band.startDate,
      endDate: band.endDate,
    }
    const current = clusters[clusters.length - 1]

    // Same cluster when this band starts on or before the cluster's current end
    // (ranges share a day). Sorted by start, so we only compare against the
    // open cluster.
    if (current && band.startDate <= current.endDate) {
      current.members.push(member)
      if (band.endDate > current.endDate) current.endDate = band.endDate
    } else {
      clusters.push({
        kind: 'timeoff',
        label: band.label,
        startDate: band.startDate,
        endDate: band.endDate,
        members: [member],
      })
    }
  }

  return clusters
}
