import type { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { logger } from "../lib/logging"
import { normalizeCode } from "../lib/promotions"

const PAGE = 500

/**
 * Runs once per shop, on the `db:migrate` that brings code normalisation
 * (F4.4, ADR-0024): every code is rewritten in the shop's form ("yaz10" →
 * "YAZ10"), since shoppers' codes are now read that way. A code whose new
 * form another promotion already has is left as it is and named in the
 * log, for the shop to rename.
 */
export default async function promotionCodesNormalized({ container }: ExecArgs) {
  const promotions = container.resolve(Modules.PROMOTION)
  const taken = new Set<string>()
  const pending: { id: string; code: string }[] = []
  for (let skip = 0; ; skip += PAGE) {
    const page = await promotions.listPromotions(
      {},
      { select: ["id", "code"], skip, take: PAGE, order: { id: "ASC" } }
    )
    for (const promotion of page) {
      const code = promotion.code ?? ""
      if (code === normalizeCode(code)) {
        taken.add(code)
      } else {
        pending.push({ id: promotion.id, code })
      }
    }
    if (page.length < PAGE) {
      break
    }
  }
  const renamed: { id: string; code: string }[] = []
  const clashes: string[] = []
  for (const { id, code } of pending) {
    const next = normalizeCode(code)
    if (taken.has(next)) {
      clashes.push(id)
      continue
    }
    taken.add(next)
    renamed.push({ id, code: next })
  }
  if (renamed.length > 0) {
    await promotions.updatePromotions(renamed)
  }
  logger.info({
    event: "promotions.codes_normalized",
    renamed: renamed.length,
    clashes: clashes.length,
    clashIds: clashes.slice(0, 50),
  })
}
