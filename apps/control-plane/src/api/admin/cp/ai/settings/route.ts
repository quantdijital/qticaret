import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { aiCreditSettingsOf } from "../../../../../lib/ai-credits/platform-settings"
import { saveAiSettingsWithKeys } from "../../../../../lib/ai-gateway/routing-keys"
import { answeringAiConflicts } from "../../../../http/ai-conflicts"
import { noteAuditChanges } from "../../../../http/audit"
import { notingPartlyDone } from "../../../../http/partly-done"
import { actorOf } from "../../tenants/params"
import type { PostAiSettingsType } from "../validators"
import { settingsChanges, settingsView, targetsView } from "../views"

/**
 * GET /admin/cp/ai/settings (owner; adr/0085 §5): the platform's day's
 * cap, the bought credits' life, the top-up packs and the routing, with
 * what may be routed (each service's capabilities and models).
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.setHeader("Cache-Control", "no-store")
  res.json({ settings: settingsView(await aiCreditSettingsOf(req.scope)), targets: targetsView() })
}

/**
 * POST /admin/cp/ai/settings (owner, step-up): any of the four changed;
 * packs get their ids here, routing is checked against the shared target
 * table and only to a service whose key is held (`cp.ai_route_no_key`,
 * 409). The audit row keeps what moved (no key is ever among them).
 */
export async function POST(
  req: AuthenticatedMedusaRequest<PostAiSettingsType>,
  res: MedusaResponse
): Promise<void> {
  // Saved but its keys' second read failed: the row still keeps what moved (`notingPartlyDone`)
  const saved = await answeringAiConflicts(res, () =>
    notingPartlyDone(
      req,
      () => saveAiSettingsWithKeys(req.scope, req.validatedBody, actorOf(req)),
      (done) => settingsChanges(done.before, done.after)
    )
  )
  if (saved === undefined) {
    return
  }
  noteAuditChanges(req, settingsChanges(saved.before, saved.after))
  res.json({ settings: settingsView(saved.after), targets: targetsView() })
}
