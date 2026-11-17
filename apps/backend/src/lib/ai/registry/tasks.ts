import { SERP_TEXT_LENGTH } from "../../seo/pixel-width"
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
  /** The longest suggestion, in characters; a longer one is refused (`length`). */
  maxLength: number
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
  maxLength: 500,
}

/**
 * A page's search result title and description (Aşama 1, docs/22 PR 1-1),
 * for a product, a category or a content page. The gate is the advisor's
 * own rules for the field (P-TITLE-01, P-META-01 and their noise rules),
 * so the longest suggestion is the field's character target.
 */
export const SEO_TITLE_TASK: AiTask = {
  id: "seo_title",
  capability: "text",
  mode: "sync",
  options: [],
  roles: ["owner", "admin"],
  credits: 1,
  gate: "seo_title",
  maxLength: SERP_TEXT_LENGTH.title.max,
}

export const SEO_DESCRIPTION_TASK: AiTask = {
  id: "seo_description",
  capability: "text",
  mode: "sync",
  options: ["short"],
  roles: ["owner", "admin"],
  credits: 1,
  gate: "seo_description",
  maxLength: SERP_TEXT_LENGTH.description.max,
}

const TASKS: readonly AiTask[] = [SEO_TITLE_TASK, SEO_DESCRIPTION_TASK]

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
