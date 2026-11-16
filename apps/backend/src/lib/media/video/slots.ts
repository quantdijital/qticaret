/**
 * A bounded number of runs at once, with a bounded, timed queue (the SVG
 * cleaner's rule, lib/media/svg.ts): a freed slot passes straight to the
 * first waiting, so the count never drops in between and no newcomer slips
 * past the queue. Past the queue, or waiting too long, `busy()` is thrown.
 */
export interface Slots {
  /** Waits for a slot; the returned release frees it (a second call does nothing). */
  take(): Promise<() => void>
  /** Runs now and waiting, for tests and logs. */
  readonly state: () => { running: number; waiting: number }
}

export interface SlotOptions {
  concurrency: number
  maxWaiting: number
  waitTimeoutMs: number
  busy: () => Error
}

export function createSlots({ concurrency, maxWaiting, waitTimeoutMs, busy }: SlotOptions): Slots {
  let running = 0
  const waiting: { take: () => void; timer: NodeJS.Timeout }[] = []

  const releaser = () => {
    let released = false
    return () => {
      if (released) {
        return
      }
      released = true
      const next = waiting.shift()
      if (next) {
        clearTimeout(next.timer)
        next.take()
      } else {
        running -= 1
      }
    }
  }

  return {
    state: () => ({ running, waiting: waiting.length }),
    async take() {
      if (running < concurrency) {
        running += 1
        return releaser()
      }
      if (waiting.length >= maxWaiting) {
        throw busy()
      }
      await new Promise<void>((resolve, reject) => {
        const entry = {
          take: resolve,
          timer: setTimeout(() => {
            const index = waiting.indexOf(entry)
            if (index >= 0) {
              waiting.splice(index, 1)
            }
            reject(busy())
          }, waitTimeoutMs).unref(),
        }
        waiting.push(entry)
      })
      return releaser()
    },
  }
}
