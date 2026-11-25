import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  aiCreditSettingsOf,
  saveAiCreditSettings,
} from "../../../../../lib/ai-credits/platform-settings"
import { noteAuditChanges } from "../../../../http/audit"
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
 * table. The audit row keeps what moved (no key is ever among them).
 */
export async function POST(
  req: AuthenticatedMedusaRequest<PostAiSettingsType>,
  res: MedusaResponse
): Promise<void> {
  const { before, after } = await saveAiCreditSettings(req.scope, req.validatedBody, actorOf(req))
  noteAuditChanges(req, settingsChanges(before, after))
  res.json({ settings: settingsView(after), targets: targetsView() })
}
