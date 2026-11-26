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
 * The small input is timed as `factor` runs back to back, so both timed
 * windows last about as long when the work is linear: a burst of load on
 * the machine then falls on both alike, and the small window is long
 * enough for the timer. A measurement that still reads as not linear is
 * taken again, up to `attempts` times, and one linear reading is enough:
 * a busy runner can slow the large runs of one measurement (CI run
 * 45781292873), while quadratic work measures about 64 against the
 * limit of 22.6 and needs every small run of a measurement slowed nearly
 * threefold to pass.
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
  /** Measurements taken before work is judged not linear (default 3). */
  attempts?: number
}

export interface Growth {
  smallMs: number
  largeMs: number
  ratio: number
  /** Highest ratio taken as linear: the geometric middle of `factor` and `factor`². */
  limit: number
  linear: boolean
}

/** The time `run` takes `times` times back to back, after emptying the heap. */
function timed(run: () => unknown, times: number): number {
  collect?.()
  const started = performance.now()
  for (let time = 0; time < times; time++) {
    run()
  }
  return performance.now() - started
}

function measureOnce(
  small: () => unknown,
  large: () => unknown,
  factor: number,
  rounds: number,
  floorMs: number
): Growth {
  let smallMs = Infinity
  let largeMs = Infinity
  for (let round = 0; round < rounds; round++) {
    smallMs = Math.min(smallMs, timed(small, factor) / factor)
    largeMs = Math.min(largeMs, timed(large, 1))
  }
  // A small run too quick to measure counts as a hundredth of a millisecond
  const ratio = largeMs / Math.max(smallMs, 0.01)
  const limit = factor ** 1.5
  return { smallMs, largeMs, ratio, limit, linear: largeMs < floorMs || ratio < limit }
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
  const attempts = Math.max(1, options.attempts ?? 3)
  const small = work(size)
  const large = work(size * factor)
  // Warm up both, so the compiler's first pass is not timed
  small()
  large()
  let growth = measureOnce(small, large, factor, rounds, floorMs)
  for (let attempt = 1; attempt < attempts && !growth.linear; attempt++) {
    growth = measureOnce(small, large, factor, rounds, floorMs)
  }
  return growth
}
