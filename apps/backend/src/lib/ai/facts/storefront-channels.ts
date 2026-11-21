import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { FactsContainer } from "./types"

/**
 * The sales channels the storefront shows (#247 D2): those of the shop's
 * publishable keys still in use, the keys a storefront asks with
 * (`api/store/reviews/visible.ts` reads the same channels from the
 * shopper's key). A revoked key and a disabled channel count for
 * nothing (fewer names is the safe side).
 * Through the key's side of Medusa's `publishable_api_key_sales_channel`
 * link; the key's ids, revocation and channels only, never its token.
 */

export const STOREFRONT_KEY_FIELDS = [
  "id",
  "revoked_at",
  "sales_channels.id",
  "sales_channels.is_disabled",
] as const

interface KeyRow {
  revoked_at?: Date | string | null
  sales_channels?: ({ id?: string | null; is_disabled?: boolean | null } | null)[] | null
}

/** The storefront's channel ids; empty when no key in use names one. */
export async function storefrontChannelIds(container: FactsContainer): Promise<Set<string>> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "api_key",
    fields: [...STOREFRONT_KEY_FIELDS],
    filters: { type: "publishable" },
  })
  const channels = new Set<string>()
  const now = Date.now()
  for (const key of data as KeyRow[]) {
    // Revoked as Medusa reads it: a revocation set for later leaves the key working until then
    if (key.revoked_at && new Date(key.revoked_at).getTime() <= now) {
      continue
    }
    for (const channel of key.sales_channels ?? []) {
      if (typeof channel?.id === "string" && channel.is_disabled !== true) {
        channels.add(channel.id)
      }
    }
  }
  return channels
}
