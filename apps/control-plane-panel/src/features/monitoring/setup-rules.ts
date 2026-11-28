import { SETUP_FACT_KEYS } from "@qticaret/types/control-plane"
import type { SetupFactKey, UsageSetup } from "@qticaret/types/control-plane"

/**
 * A shop's setup checklist as its last usage report said it (adr/0061 Ek
 * C21): yes/no per step, in the shop panel's own order. Null when the
 * shop sent none (no report yet, or an older release).
 */
export interface SetupProgress {
  steps: { key: SetupFactKey; done: boolean }[]
  done: number
  total: number
  missing: SetupFactKey[]
  complete: boolean
}

export function setupProgress(setup: UsageSetup | null | undefined): SetupProgress | null {
  if (!setup) {
    return null
  }
  // A key the panel does not know yet (a newer shop) is left out, not guessed
  const steps = SETUP_FACT_KEYS.map((key) => ({ key, done: setup[key] }))
  const missing = steps.filter((step) => !step.done).map((step) => step.key)
  return {
    steps,
    done: steps.length - missing.length,
    total: steps.length,
    missing,
    complete: missing.length === 0,
  }
}
