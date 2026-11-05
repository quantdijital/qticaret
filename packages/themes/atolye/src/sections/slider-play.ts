/** The visitor's own word on a slider's autoplay: none yet, play, or stop (for good). */
export type PlayChoice = "play" | "stop" | null

/**
 * Whether a slider plays (adr/0049 Ek 2026-11-06): never with one slide;
 * the visitor's own word first; else only when the shop turned autoplay
 * on, the page's script runs and the visitor does not ask for reduced
 * motion. Still by default.
 */
export function isPlaying({
  autoplay,
  count,
  choice,
  hydrated,
  reducedMotion,
}: {
  autoplay: boolean
  count: number
  choice: PlayChoice
  hydrated: boolean
  reducedMotion: boolean
}): boolean {
  if (count < 2 || !autoplay) {
    return false
  }
  return choice === null ? hydrated && !reducedMotion : choice === "play"
}

/** The slide a step lands on: past the last is the first, before the first the last. */
export const wrapIndex = (to: number, count: number): number =>
  count > 0 ? ((to % count) + count) % count : 0
