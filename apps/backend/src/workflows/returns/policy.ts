import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { isNonWithdrawableLine } from "../../lib/catalog/addons"
import { giftLineUsed } from "../../lib/orders/gift-returns"
import type { GiftLineFacts } from "../../lib/orders/gift-returns"
import type { WithdrawalExclusion } from "../../lib/orders/returns"
import { productMarkOf } from "../../lib/orders/withdrawal-rules"
import type { WithdrawalWarning } from "../../lib/orders/withdrawal-rules"
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

/** What the order's lines owe to the right of withdrawal, by line id. */
export interface WithdrawalFacts {
  /** Outside the right, and why (`WithdrawalExclusion`). */
  excluded: Map<string, WithdrawalExclusion>
  /** Inside it, with a warning: a hygiene good returnable while sealed (md. 15/1-ç). */
  warnings: Map<string, WithdrawalWarning>
}

/**
 * The order's lines outside the right of withdrawal, and why, and those
 * inside it with a warning (adr/0032 Ek 2026-11-03): a product's own mark
 * (F13.6) by the product's kind (`productMarkOf`: a digital or service one
 * is out, a physical one is a sealed good), an add-on made to the buyer's
 * wish that the line records (adr/0052 §8; the record as sold, not the
 * product now), or a gift card line whose cards were spent (adr/0025,
 * 2026-11-03). `gifts`: the order's gift lines, when read already.
 */
export async function withdrawalFactsOf(
  container: Container,
  items: readonly ItemRow[],
  gifts?: ReadonlyMap<string, GiftLineFacts>
): Promise<WithdrawalFacts> {
  const excluded = new Map<string, WithdrawalExclusion>()
  const warnings = new Map<string, WithdrawalWarning>()
  const productIds = [
    ...new Set(items.flatMap((item) => (item?.product_id ? [item.product_id] : []))),
  ]
  const { data } = productIds.length
    ? await container.resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "product",
        fields: ["id", "product_extension.withdrawal_excluded", "product_extension.kind"],
        filters: { id: productIds },
      })
    : { data: [] }
  const marks = new Map(
    (
      data as {
        id: string
        product_extension?: { withdrawal_excluded?: boolean | null; kind?: string | null } | null
      }[]
    ).map((product) => [
      product.id,
      productMarkOf(
        product.product_extension?.withdrawal_excluded,
        product.product_extension?.kind
      ),
    ])
  )
  for (const item of items) {
    const mark = item?.product_id ? marks.get(item.product_id) : undefined
    if (item && mark?.excluded) {
      excluded.set(item.id, "product")
    }
    if (item && mark?.warning) {
      warnings.set(item.id, mark.warning)
    }
    if (item && isNonWithdrawableLine(item.metadata)) {
      excluded.set(item.id, "personal_addon")
    }
  }
  for (const line of (gifts ?? (await giftLinesOf(container, items))).values()) {
    if (giftLineUsed(line)) {
      excluded.set(line.line_id, "gift_card_used")
    }
  }
  // Out is out: a line outside the right needs no seal warning
  for (const id of excluded.keys()) {
    warnings.delete(id)
  }
  return { excluded, warnings }
}

/** The order's lines outside the right of withdrawal, by line id, and why (`withdrawalFactsOf`). */
export async function exclusionsOf(
  container: Container,
  items: readonly ItemRow[],
  gifts?: ReadonlyMap<string, GiftLineFacts>
): Promise<Map<string, WithdrawalExclusion>> {
  return (await withdrawalFactsOf(container, items, gifts)).excluded
}

/** The order's lines outside the right of withdrawal, by line id (`withdrawalFactsOf`). */
export async function excludedLines(
  container: Container,
  items: readonly ItemRow[],
  gifts?: ReadonlyMap<string, GiftLineFacts>
): Promise<Set<string>> {
  return new Set((await exclusionsOf(container, items, gifts)).keys())
}
