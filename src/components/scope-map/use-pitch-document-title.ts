import { useEffect } from 'react'

export function usePitchDocumentTitle(
  pitch: { emoji: string; title: string },
  cycleTitle: string
) {
  useEffect(() => {
    const label = [pitch.emoji, pitch.title].filter(Boolean).join(' ')
    document.title = `${label} | ${cycleTitle} | Cycles`
  }, [pitch.emoji, pitch.title, cycleTitle])
}
