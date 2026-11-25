import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { aiCreditSettingsOf } from "../../../../../lib/ai-credits/platform-settings"
import { keyedServices, providerKeysHeld } from "../../../../../lib/ai-gateway/keys"
import { capabilitiesRoutedTo } from "../../../../../lib/ai-gateway/routing"

/**
 * GET /admin/cp/ai/providers (owner; adr/0085 §2): each service the
 * platform may hold a key for, whether it holds one (its version and when
 * it was written, never the key) and the capabilities routed to it.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const [held, settings] = await Promise.all([
    providerKeysHeld(req.scope),
    aiCreditSettingsOf(req.scope),
  ])
  res.setHeader("Cache-Control", "no-store")
  res.json({
    providers: keyedServices().map((service) => {
      const key = held.get(service)
      return {
        service,
        has_key: key !== undefined,
        version: key?.version ?? null,
        written_at: key?.written_at ?? null,
        routed: capabilitiesRoutedTo(settings.routing, service),
      }
    }),
  })
}
