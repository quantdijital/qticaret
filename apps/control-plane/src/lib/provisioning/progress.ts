import type { MedusaContainer } from "@medusajs/framework/types"
import type { RunView, StepView } from "../../modules/provisioning/service"
import { provisioningIn } from "../../workflows/modules"
import type { StartedRun } from "./runs"

const out = (line: string) => process.stdout.write(`${line}\n`)

/** A step as one line: place, name, status, code, its non-secret output. */
export function stepLine(step: StepView, total: number): string {
  const place = `[${String(step.position + 1).padStart(2)}/${String(total)}]`
  const code = step.error_code ? ` ${step.error_code}` : ""
  const made = step.created ? " (made)" : ""
  const output =
    step.output && Object.keys(step.output).length > 0 ? ` ${JSON.stringify(step.output)}` : ""
  return `${place} ${step.name.padEnd(14)} ${step.status}${made}${code}${output}`
}

export function printRun(run: RunView): void {
  out(
    `run ${run.id} ${run.kind} ${run.status}${run.error_code ? ` ${run.error_code}` : ""}` +
      (run.port ? ` port=${String(run.port)}` : "")
  )
  const steps = run.steps ?? []
  for (const step of steps) {
    out(`  ${stepLine(step, steps.length)}`)
  }
}

/**
 * Follows a run as it goes: each step's line when its status changes,
 * then the run's end. Statuses, codes and outputs only: a run holds no
 * secret, link or address.
 */
export async function followRun(container: MedusaContainer, started: StartedRun): Promise<RunView> {
  const seen = new Map<string, string>()
  const state = { finished: false }
  const show = async () => {
    const run = await provisioningIn(container).runOf(started.run.tenant_id, started.run.id)
    const steps = run.steps ?? []
    for (const step of steps) {
      const key = `${step.status}|${step.error_code ?? ""}`
      if (step.status !== "pending" && seen.get(step.name) !== key) {
        seen.set(step.name, key)
        out(stepLine(step, steps.length))
      }
    }
  }
  const ticker = (async () => {
    while (!state.finished) {
      await show().catch(() => undefined)
      await new Promise((resolve) => setTimeout(resolve, 1_000))
    }
  })()
  const done = await started.done
  state.finished = true
  await ticker
  await show().catch(() => undefined)
  out(`run ${done.id} ${done.kind} ${done.status}${done.error_code ? ` ${done.error_code}` : ""}`)
  return done
}
