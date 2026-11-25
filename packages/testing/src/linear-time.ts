/**
 * Whether a piece of work grows linearly with its input, judged without a
 * wall-clock budget (a slow or busy CI machine broke fixed "under 200 ms"
 * checks). The work runs on an input of `size` and of `factor` × `size`;
 * linear work takes about `factor` times as long, quadratic work about
 * `factor`² times. Each size is timed `rounds` times, alternating, and the
 * fastest round counts, so one pause of the machine does not decide. The
 * heap is emptied before each timed run: without it, linear work that
 * builds big strings (a parser's) paid for the earlier runs' garbage and
 * measured about 16 to 23 against a limit of 22.6 (2026-11-25); with it,
 * about 5 to 8.
 *
 * Work whose large run stays under `floorMs` passes whatever its ratio:
 * at such sizes a quadratic scan takes far longer, and sub-millisecond
 * timings are mostly noise.
 */

import { setFlagsFromString } from "node:v8"
import { runInNewContext } from "node:vm"

/**
 * The garbage collector, to empty the heap before each timed run: a large
 * run otherwise pays for the garbage the runs before it left. Jest's own
 * leak detector reaches it the same way; without it, runs are timed as
 * they come.
 */
const collect: (() => void) | undefined = (() => {
  const exposed = (globalThis as { gc?: () => void }).gc
  if (typeof exposed === "function") {
    return exposed
  }
  try {
    setFlagsFromString("--expose-gc")
    const gc = runInNewContext("gc") as unknown
    return typeof gc === "function" ? (gc as () => void) : undefined
  } catch {
    return undefined
  }
})()

export interface GrowthOptions {
  /** How many times larger the second input is (default 8). */
  factor?: number
  /** Timed runs of each size; the fastest counts (default 5). */
  rounds?: number
  /** A large run under this passes outright (default 20 ms). */
  floorMs?: number
}

export interface Growth {
  smallMs: number
  largeMs: number
  ratio: number
  /** Highest ratio taken as linear: the geometric middle of `factor` and `factor`². */
  limit: number
  linear: boolean
}

function fastest(run: () => unknown, times: number[]): void {
  collect?.()
  const started = performance.now()
  run()
  times.push(performance.now() - started)
}

/**
 * Times `work(size)` against `work(size * factor)`. `work` builds its input
 * from a size and runs it; keep input building cheap or outside the timing
 * by returning a closure: `(n) => { const text = "a".repeat(n); return () => f(text) }`.
 */
export function measureGrowth(
  work: (size: number) => () => unknown,
  size: number,
  options: GrowthOptions = {}
): Growth {
  const factor = options.factor ?? 8
  const rounds = options.rounds ?? 5
  const floorMs = options.floorMs ?? 20
  const small = work(size)
  const large = work(size * factor)
  // Warm up both, so the compiler's first pass is not timed
  small()
  large()
  const smallTimes: number[] = []
  const largeTimes: number[] = []
  for (let round = 0; round < rounds; round++) {
    fastest(small, smallTimes)
    fastest(large, largeTimes)
  }
  const smallMs = Math.min(...smallTimes)
  const largeMs = Math.min(...largeTimes)
  // A small run too quick to measure counts as a hundredth of a millisecond
  const ratio = largeMs / Math.max(smallMs, 0.01)
  const limit = factor ** 1.5
  return { smallMs, largeMs, ratio, limit, linear: largeMs < floorMs || ratio < limit }
}
