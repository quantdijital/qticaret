import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ProvisioningError } from "../../lib/provisioning/provisioner"
import { provisioningIn } from "../modules"

/** What every step of a run gets: ids only (adr/0061 §4.3: no secret in a workflow). */
export interface RunInput {
  run_id: string
  tenant_id: string
  /**
   * Development and tests only (Ek C10): this step fails before it does
   * anything, so the compensation of everything before it can be seen.
   */
  fail_at?: string | null
}

export interface StepOutcome<U> {
  status: "succeeded" | "skipped"
  /** This run made what the step stands for: its compensation undoes it. */
  created: boolean
  /** A non-secret summary for the run's page. */
  output?: Record<string, unknown>
  /** A warning's code (the step still counts as done). */
  warning?: string
  /** What the compensation needs, when `created`. */
  undo?: U
}

const CODE = /^[a-z_]+(?:\.[a-z0-9_]+)+$/

/** An error as a code fit to keep: ours, or Medusa's when its message is one; never a message. */
export function codeOf(error: unknown): string {
  if (error instanceof ProvisioningError) {
    return error.code
  }
  if (error instanceof MedusaError && CODE.test(error.message)) {
    return error.message
  }
  return "provisioning.step_failed"
}

interface Back<U> {
  /** Marks a real undo: without a compensation input Medusa hands the step's output instead. */
  kind: "provisioning_undo"
  run_id: string
  undo: U
}

const isBack = <U>(value: unknown): value is Back<U> =>
  typeof value === "object" &&
  value !== null &&
  (value as { kind?: unknown }).kind === "provisioning_undo"

/**
 * A provisioning step (adr/0061 §6.2): recorded as it starts and ends on
 * the run's page; idempotent (it looks first and skips what is there);
 * its compensation undoes only what this run made (`created`), and marks
 * the step `compensated`.
 */
export function provisionStep<U = undefined>(
  name: string,
  body: (input: RunInput, container: MedusaContainer) => Promise<StepOutcome<U>>,
  undo?: (undo: U, input: { run_id: string }, container: MedusaContainer) => Promise<void>
) {
  return createStep<RunInput, Record<string, unknown>, Back<U> | undefined>(
    name,
    async (input, { container }) => {
      const runs = provisioningIn(container)
      await runs.stepStarted(input.run_id, name)
      let outcome: StepOutcome<U>
      try {
        if (input.fail_at === name) {
          throw new ProvisioningError("provisioning.injected_failure")
        }
        outcome = await body(input, container)
      } catch (error) {
        await runs.stepEnded(input.run_id, name, { status: "failed", error_code: codeOf(error) })
        throw error
      }
      await runs.stepEnded(input.run_id, name, {
        status: outcome.status,
        created: outcome.created,
        error_code: outcome.warning ?? null,
        output: outcome.output ?? null,
      })
      const back =
        outcome.created && undo
          ? { kind: "provisioning_undo" as const, run_id: input.run_id, undo: outcome.undo as U }
          : undefined
      return new StepResponse(outcome.output ?? {}, back)
    },
    async (back, { container }) => {
      // Nothing this run made (Medusa then passes the step's output here): nothing to undo
      if (!isBack<U>(back) || !undo) {
        return
      }
      const runs = provisioningIn(container)
      try {
        await undo(back.undo, back, container)
      } catch (error) {
        await runs.stepEnded(back.run_id, name, {
          status: "failed",
          error_code: `provisioning.compensation_failed:${codeOf(error)}`.slice(0, 120),
        })
        throw error
      }
      await runs.stepEnded(back.run_id, name, { status: "compensated" })
    }
  )
}
