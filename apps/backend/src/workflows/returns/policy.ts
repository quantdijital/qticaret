import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { isNonWithdrawableLine } from "../../lib/catalog/addons"
import { giftLineUsed } from "../../lib/orders/gift-returns"
import type { GiftLineFacts } from "../../lib/orders/gift-returns"
import type { WithdrawalExclusion } from "../../lib/orders/returns"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { ReturnsSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { giftLinesOf } from "./gift-lines"

type Container = Pick<MedusaContainer, "resolve">

/** The shop's return policy (F13.6): its withdrawal period and who pays the return. */
export async function returnPolicy(container: Container): Promise<ReturnsSettings> {
  return (await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .getSection("returns")) as unknown as ReturnsSettings
}

type ItemRow = { id: string; product_id?: string | null; metadata?: unknown } | null

/**
 * The order's lines outside the right of withdrawal, by line id, and why
 * (`WithdrawalExclusion`): their product's mark (F13.6), an add-on made to
 * the buyer's wish that the line records (adr/0052 §8; the record as sold,
 * not the product now), or a gift card line whose cards were spent
 * (adr/0025, 2026-11-03). `gifts`: the order's gift lines, when read already.
 */
export async function exclusionsOf(
  container: Container,
  items: readonly ItemRow[],
  gifts?: ReadonlyMap<string, GiftLineFacts>
): Promise<Map<string, WithdrawalExclusion>> {
  const reasons = new Map<string, WithdrawalExclusion>()
  const productIds = [
    ...new Set(items.flatMap((item) => (item?.product_id ? [item.product_id] : []))),
  ]
  const { data } = productIds.length
    ? await container.resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "product",
        fields: ["id", "product_extension.withdrawal_excluded"],
        filters: { id: productIds },
      })
    : { data: [] }
  const excluded = new Set(
    (data as { id: string; product_extension?: { withdrawal_excluded?: boolean } | null }[])
      .filter((product) => product.product_extension?.withdrawal_excluded)
      .map((product) => product.id)
  )
  for (const item of items) {
    if (item?.product_id && excluded.has(item.product_id)) {
      reasons.set(item.id, "product")
    }
    if (item && isNonWithdrawableLine(item.metadata)) {
      reasons.set(item.id, "personal_addon")
    }
  }
  for (const line of (gifts ?? (await giftLinesOf(container, items))).values()) {
    if (giftLineUsed(line)) {
      reasons.set(line.line_id, "gift_card_used")
    }
  }
  return reasons
}

/** The order's lines outside the right of withdrawal, by line id (`exclusionsOf`). */
export async function excludedLines(
  container: Container,
  items: readonly ItemRow[],
  gifts?: ReadonlyMap<string, GiftLineFacts>
): Promise<Set<string>> {
  return new Set((await exclusionsOf(container, items, gifts)).keys())
}
