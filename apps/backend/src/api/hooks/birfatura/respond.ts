import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { isProviderError } from "../../../lib/errors"
import { birfaturaTexts } from "../../../lib/invoicing/birfatura"
import type { BirfaturaMessage } from "../../../lib/invoicing/birfatura"
import { auditContext, auditService } from "../../http/audit/context"
import type { AuditEntryInput } from "../../../modules/audit-log/service"

/**
 * BirFatura's answer shape for its update services (adr/0072 §6):
 * `{ Success, Message }`, always valid JSON, never an internal detail.
 */
export function answer(
  res: MedusaResponse,
  success: boolean,
  message: BirfaturaMessage,
  status = 200
): void {
  res.setHeader("Cache-Control", "no-store")
  res.status(status).json({ Success: success, Message: birfaturaTexts().messages[message] })
}

const OUR_CODE = /^einvoice\.[a-z_]{1,60}$/

/**
 * A refusal's code for the record: the write-back's own (`einvoice.*`;
 * a workflow hands errors back by shape: its `safeMessage`, or Medusa's
 * `message`), a PDF that could not be fetched, or a general one. Never a
 * message that may quote input.
 */
export function refusalCode(error: unknown): string {
  if (isProviderError(error)) {
    return "einvoice.pdf_download_failed"
  }
  const shape = (error ?? {}) as { safeMessage?: unknown; message?: unknown }
  for (const candidate of [shape.safeMessage, shape.message]) {
    if (typeof candidate === "string" && OUR_CODE.test(candidate)) {
      return candidate
    }
  }
  return "einvoice.error"
}

/**
 * An audit entry for one of BirFatura's calls (adr/0072 §3.9): who is
 * BirFatura, never a staff member; ids only, never a buyer's detail or
 * the token. Throws when it cannot be written: the caller decides.
 */
export async function auditBirfatura(
  req: MedusaRequest,
  entry: Pick<AuditEntryInput, "kind" | "action" | "resource_id" | "outcome" | "changes">
): Promise<void> {
  const context = auditContext(req)
  await auditService(req).record({
    ...entry,
    resource_type: "invoice",
    actor_type: "system",
    actor_id: "birfatura",
    request_id: context.request_id ?? null,
    ip: context.ip ?? null,
    user_agent: context.user_agent ?? null,
  })
}
