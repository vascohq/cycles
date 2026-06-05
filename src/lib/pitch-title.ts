export function formatPitchTitle(
  pitch: { emoji: string; title: string } | null,
  cycleTitle: string,
  fallback = ''
): string {
  const label = pitch
    ? [pitch.emoji, pitch.title].filter(Boolean).join(' ')
    : fallback
  return `${label} | ${cycleTitle} | Cycles`
}
