import * as React from "react"

/** The wait before a held arrow starts repeating, then the first repeat's pace. */
const FIRST_WAIT = 400
const FIRST_PACE = 90
/** Holding longer speeds up to this. */
const FASTEST_PACE = 30

/**
 * Press-and-hold for a number field's arrows: one step on press, then,
 * after a short wait, a step every few dozen milliseconds, faster the
 * longer it is held. `tick` makes one step and says whether there was
 * room for it; at min or max the repeat stops by itself. Letting go
 * anywhere (the pointer may have left the arrow), the window losing focus
 * or the field going away stops it too.
 */
export function useHoldStep() {
  const timer = React.useRef<number | undefined>(undefined)
  const release = React.useRef<(() => void) | undefined>(undefined)
  const stop = React.useCallback(() => {
    window.clearTimeout(timer.current)
    timer.current = undefined
    release.current?.()
    release.current = undefined
  }, [])
  React.useEffect(() => stop, [stop])
  const start = React.useCallback(
    (tick: () => boolean) => {
      stop()
      if (!tick()) {
        return
      }
      const again = (wait: number, pace: number) => {
        timer.current = window.setTimeout(() => {
          if (tick()) {
            again(pace, Math.max(FASTEST_PACE, Math.round(pace * 0.85)))
          } else {
            stop()
          }
        }, wait)
      }
      again(FIRST_WAIT, FIRST_PACE)
      const events = ["pointerup", "pointercancel", "blur"] as const
      for (const name of events) {
        window.addEventListener(name, stop)
      }
      release.current = () => {
        for (const name of events) {
          window.removeEventListener(name, stop)
        }
      }
    },
    [stop]
  )
  return { start, stop }
}
