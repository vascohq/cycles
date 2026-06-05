import { useEffect } from 'react'
import { formatPitchTitle } from '@/lib/pitch-title'

export function usePitchDocumentTitle(
  pitch: { emoji: string; title: string },
  cycleTitle: string
) {
  useEffect(() => {
    document.title = formatPitchTitle(pitch, cycleTitle)
  }, [pitch.emoji, pitch.title, cycleTitle])
}
