import type { MedusaRequest } from "@medusajs/framework/http"
import { codeSummary } from "@qticaret/server-kit"
import { PartlyDoneError } from "../../lib/ai-gateway/partly-done"
import { noteAuditChanges } from "./audit"

/**
 * `run`'s result. When it stopped partway (`PartlyDoneError`), what it
 * had done goes on the audit row (`changesOf`, as on success) with
 * `unfinished`: the step that failed and the failure's class name and
 * code, never its message; then the original failure is thrown on, so the
 * answer is unchanged. Any other error goes on as it is.
 */
export async function notingPartlyDone<T>(
  req: MedusaRequest,
  run: () => Promise<T>,
  changesOf: (done: T) => Record<string, unknown>
): Promise<T> {
  try {
    return await run()
  } catch (error) {
    if (!(error instanceof PartlyDoneError)) {
      throw error
    }
    noteAuditChanges(req, {
      ...changesOf(error.done as T),
      unfinished: { step: error.step, ...codeSummary(error.failure) },
    })
    throw error.failure
  }
}
