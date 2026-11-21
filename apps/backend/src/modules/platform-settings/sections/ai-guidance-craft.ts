import { defaultCraftOf, isCraftTask } from "../../../lib/ai/instructions"
import type { AiGuidanceSettings, AiTaskGuidance } from "./ai-guidance"
import { isPlainObject, mergePatch } from "./define"
import type { SectionSaveIssue } from "./define"

/**
 * The owner's own craft of a text task (adr/0074 §3) in a save of the
 * `ai_guidance` section: a task's entry sent without `craft` keeps the
 * stored one (an admin's save of its note never sends it, and never
 * clears it); a craft that reads as the default is no craft; and the
 * default's version is kept beside it (`craft_base`) by the server: set
 * when the craft's text changes, kept when it does not, and moved to the
 * current version only when sent as it (the panel's "keep mine" after a
 * deploy changed the default). Who may send it is the route's to check.
 */

export const CRAFT_BASE_UNKNOWN = "ai.guidance_craft_base_unknown"
const UNKNOWN_TASK = "ai.guidance_unknown_task"

type CraftFields = Pick<AiTaskGuidance, "craft" | "craft_base">

function craftFields(
  id: string,
  sent: Record<string, unknown>,
  old: AiTaskGuidance | undefined
): CraftFields {
  const standard = defaultCraftOf(id)
  const before = old?.craft ?? null
  const craft = sent["craft"] === undefined ? before : (sent["craft"] as string | null)
  if (craft === null || craft === standard?.craft) {
    const untouched = old?.craft === undefined && sent["craft"] === undefined
    return untouched ? {} : { craft: null, craft_base: null }
  }
  const asked = sent["craft_base"] as string | null | undefined
  if (asked !== undefined) {
    return { craft, craft_base: asked }
  }
  const kept = craft === before ? (old?.craft_base ?? null) : null
  return { craft, craft_base: kept ?? standard?.version ?? null }
}

/** The patch over the stored values, a task's craft and its version as above. */
export function mergeGuidance(
  before: AiGuidanceSettings,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const merged = mergePatch(before, patch)
  const sent = patch["tasks"]
  if (!isPlainObject(sent)) {
    return merged
  }
  const tasks: Record<string, unknown> = { ...(merged["tasks"] as Record<string, unknown>) }
  for (const [id, entry] of Object.entries(sent)) {
    if (!isPlainObject(entry)) {
      continue
    }
    const old = Object.hasOwn(before.tasks, id) ? before.tasks[id] : undefined
    const rest = Object.entries(entry).filter(([key]) => key !== "craft" && key !== "craft_base")
    tasks[id] = { ...Object.fromEntries(rest), ...craftFields(id, entry, old) }
  }
  return { ...merged, tasks }
}

/**
 * What a save may not leave behind, a stored row is not held to: a craft
 * newly written for a task that takes none (a picture's alt text, a card
 * from a photo), and a version the server never wrote.
 */
export function guidanceSaveIssue(
  after: AiGuidanceSettings,
  before: AiGuidanceSettings
): SectionSaveIssue | null {
  for (const [id, entry] of Object.entries(after.tasks)) {
    const old = Object.hasOwn(before.tasks, id) ? before.tasks[id] : undefined
    if (entry?.craft && entry.craft !== old?.craft && !isCraftTask(id)) {
      return { message: UNKNOWN_TASK, path: ["tasks", id, "craft"] }
    }
    const base = entry?.craft_base ?? null
    if (base !== null && base !== old?.craft_base && base !== defaultCraftOf(id)?.version) {
      return { message: CRAFT_BASE_UNKNOWN, path: ["tasks", id, "craft_base"] }
    }
  }
  return null
}

/** Whether a body's tasks send a craft or its version at all: the owner's alone (adr/0074 §3). */
export function sendsCraft(tasks: unknown): boolean {
  if (!isPlainObject(tasks)) {
    return false
  }
  return Object.values(tasks).some(
    (entry) =>
      isPlainObject(entry) && (entry["craft"] !== undefined || entry["craft_base"] !== undefined)
  )
}
