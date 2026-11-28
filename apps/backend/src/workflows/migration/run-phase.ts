import type { StepProgress } from "../../lib/migration/types"
import type MigrationModuleService from "../../modules/migration/service"
import type { RunPhase } from "../../modules/migration/service"

// The live step is written at most this often; its first and last count always are
const EVERY_MS = 1000

type Clock = () => number

/**
 * A run's live step (adr/0042 Ek 2026-11-27): the kind it is moving and
 * how many of how many, kept beside the run's counts (`_phase`) so the
 * panel shows each kind's own progress (612 / 1002 pictures), not one
 * percentage. A kind's counts are written as it ends, as before.
 */
export class RunPhases {
  private last = 0
  private kind: string | null = null

  constructor(
    private readonly migration: Pick<MigrationModuleService, "setPhase">,
    private readonly runId: string,
    private readonly kinds: readonly string[],
    private readonly now: Clock = Date.now
  ) {}

  /** Where the run is: `kind`, `done` of `total`. */
  async at(kind: string, done: number, total: number): Promise<void> {
    const time = this.now()
    const edge = kind !== this.kind || done === 0 || done >= total
    if (!edge && time - this.last < EVERY_MS) {
      return
    }
    this.kind = kind
    this.last = time
    const phase: RunPhase = { kinds: this.kinds, kind, done, total }
    await this.migration.setPhase(this.runId, phase)
  }

  /** A step's progress told to the job and kept as the kind's own. */
  track(kind: string, job: StepProgress): StepProgress {
    return async (done, total) => {
      await this.at(kind, done, total)
      await job(done, total)
    }
  }
}

/**
 * A step that counts in one unit (products) told in another (their
 * pictures): `weights[i]` units in item i; done items → done units.
 */
export function weighted(
  weights: readonly number[],
  tell: (done: number, total: number) => Promise<void>
): StepProgress {
  const sums: number[] = [0]
  for (const weight of weights) {
    sums.push((sums.at(-1) ?? 0) + weight)
  }
  const total = sums.at(-1) ?? 0
  return (done) => tell(sums[Math.min(done, weights.length)] ?? total, total)
}
