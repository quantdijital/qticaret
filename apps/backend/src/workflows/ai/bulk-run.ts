import { errorSummary, logger } from "../../lib/logging"

/**
 * The loop of an AI bulk job (adr/0071 §8, docs/22 "Aşama 5"): each item
 * asked one by one through the same workflow as a single ask, so each
 * claims its own quota, writes its own usage row and keeps its own
 * suggestion. An item that fails alone is counted and the job goes on
 * (partial success); when the month's or the day's ceiling is reached,
 * or no service can do the work, the job stops and the rest is counted
 * as not asked. Shared by the alt text job and the SEO fill (adr/0074 §5
 * madde 7).
 */

export interface BulkSummary {
  asked: number
  suggested: number
  refused: number
  failed: number
  /** Not worth asking for (already done, a suggestion waiting): not asked. */
  skipped: number
  /** Not asked because the job stopped. */
  not_asked: number
  /** The key the job stopped on; null when it went through. */
  stopped: string | null
}

// Every later item would fail the same way: stop rather than spend the attempts
const STOP_KEYS: ReadonlySet<string> = new Set([
  "plan.limit_reached",
  "ai.daily_limit_reached",
  "ai.no_service",
  "ai.service_unavailable",
  "ai.own_keys_not_in_plan",
  "ai.key_rejected",
  "ai.provider_balance",
  "ai.provider_quota",
  "staff.forbidden",
])

/** The i18n key a failed run carries, in whatever shape the workflow hands it back. */
export function errorKeyOf(error: unknown): string {
  const shape = (error ?? {}) as { qtErrorKind?: unknown; safeMessage?: unknown; message?: unknown }
  if (shape.qtErrorKind === "plan_limit") {
    return "plan.limit_reached"
  }
  if (typeof shape.safeMessage === "string") {
    return shape.safeMessage
  }
  return typeof shape.message === "string" ? shape.message : ""
}

export interface BulkDeps<Item> {
  /** Checked again just before each ask: a suggestion made meanwhile is not asked for twice. */
  waiting: (item: Item) => Promise<boolean>
  /** One ask; throws the workflow's error. */
  suggest: (item: Item) => Promise<"draft" | "refused">
  progress: (percent: number) => Promise<void>
  /** The log event a lone failure is written under. */
  failedEvent: string
}

/** Asks for each item in turn; `skipped` starts at what the caller left out before. */
export async function runBulkSuggestions<Item>(
  deps: BulkDeps<Item>,
  items: readonly Item[],
  skipped: number
): Promise<BulkSummary> {
  const summary: BulkSummary = {
    asked: 0,
    suggested: 0,
    refused: 0,
    failed: 0,
    skipped,
    not_asked: 0,
    stopped: null,
  }
  for (const [index, item] of items.entries()) {
    if (await deps.waiting(item)) {
      summary.skipped += 1
      await deps.progress(Math.round(((index + 1) / items.length) * 100))
      continue
    }
    summary.asked += 1
    try {
      const status = await deps.suggest(item)
      summary[status === "draft" ? "suggested" : "refused"] += 1
    } catch (error) {
      const key = errorKeyOf(error)
      if (STOP_KEYS.has(key)) {
        // The item that met the ceiling was not asked either
        summary.asked -= 1
        summary.not_asked = items.length - index
        summary.stopped = key
        break
      }
      // The summary counts it only; what went wrong goes to the log, redacted
      logger.warn({ event: deps.failedEvent, key, err: errorSummary(error) })
      summary.failed += 1
    }
    await deps.progress(Math.round(((index + 1) / items.length) * 100))
  }
  return summary
}
