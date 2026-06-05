import { useEffect } from 'react'

export function formatPitchTitle(
  pitch: { emoji: string; title: string },
  cycleTitle: string
): string {
  const label = [pitch.emoji, pitch.title].filter(Boolean).join(' ')
  return `${label} | ${cycleTitle} | Cycles`
}

export function usePitchDocumentTitle(
  pitch: { emoji: string; title: string },
  cycleTitle: string
) {
  useEffect(() => {
    document.title = formatPitchTitle(pitch, cycleTitle)
  }, [pitch.emoji, pitch.title, cycleTitle])
}
