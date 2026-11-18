import type { MedusaRequest } from "@medusajs/framework/http"
import { AUDIT_LOG_MODULE } from "../../../../modules/audit-log"
import type AuditLogModuleService from "../../../../modules/audit-log/service"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../../../modules/integration-credentials/service"

/**
 * What the BirFatura card shows (adr/0072; the card is F2): whether a
 * connection token was made and when, and BirFatura's last pull from the
 * audit log (when, how many orders). Never the token: it was shown once.
 */
export async function birfaturaView(req: MedusaRequest) {
  const account = await req.scope
    .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
    .describe("birfatura")
  const [pull] = await req.scope
    .resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
    .listAuditEntries(
      { action: "birfatura.orders_pulled" },
      { select: ["created_at", "changes"], order: { created_at: "DESC" }, take: 1 }
    )
  const orders = (pull?.changes as { orders?: unknown } | null | undefined)?.orders
  return {
    // "unreadable": the server's key changed and the token no longer opens; make a new one
    token:
      account.state === "not_configured"
        ? null
        : { state: account.state, made_at: account.updated_at },
    last_pull: pull
      ? { at: pull.created_at, orders: typeof orders === "number" ? orders : 0 }
      : null,
  }
}
