import type { StaffRole } from "../../staff/permissions"
import type { AiCapability } from "./capabilities"

/**
 * A task: one named operation bound to a capability (adr/0071 §2). There
 * is no free prompt: what is asked comes from the task and, at most, one
 * of its two ready-made options.
 */

export type AiTaskMode = "sync" | "job"

/** What the output is checked as before it is offered (lib/ai/gate.ts). */
export const AI_GATES = ["seo_title", "seo_description", "plain_text"] as const
export type AiGate = (typeof AI_GATES)[number]

export const MAX_TASK_OPTIONS = 2

export interface AiTask {
  id: string
  capability: AiCapability
  /** `job` runs as an async job (adr/0014); `sync` answers in the request. */
  mode: AiTaskMode
  /** Ready-made choices next to the button (a tone), two at most. */
  options: readonly string[]
  /** Staff roles that may ask for it; checked in the workflow too. */
  roles: readonly StaffRole[]
  /** Platform credits one run costs (adr/0071 §7); never taken from the client. */
  credits: number
  gate: AiGate
}

/** Tests only: the core is exercised with it until the real tasks come (Aşama 1). */
export const TEST_TASK: AiTask = {
  id: "test_text",
  capability: "text",
  mode: "sync",
  options: ["plain", "detailed"],
  roles: ["owner", "admin"],
  credits: 1,
  gate: "plain_text",
}

// Real tasks (`seo_title`, `seo_description`) are added in Aşama 1
const TASKS: readonly AiTask[] = []

/** The tasks of this instance, in registry order. */
export function aiTasks(nodeEnv: string | undefined = process.env["NODE_ENV"]): readonly AiTask[] {
  return nodeEnv === "test" ? [...TASKS, TEST_TASK] : TASKS
}

export function findAiTask(
  id: string,
  nodeEnv: string | undefined = process.env["NODE_ENV"]
): AiTask | null {
  return aiTasks(nodeEnv).find((task) => task.id === id) ?? null
}
