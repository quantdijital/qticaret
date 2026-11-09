import type { MedusaContainer } from "@medusajs/framework/types"
import { withoutAddonTexts } from "../../lib/catalog/addons"
import { rewriteOrderLines } from "../legal/erasure/order-lines"

type Container = Pick<MedusaContainer, "resolve">

/**
 * The texts the buyer typed on these orders' add-on lines erased in every
 * copy the order keeps (adr/0052 §10 and its Ek 2026-11-09,
 * docs/kvkk-envanter.md): the line item, each order version's item and
 * the cart's line. A text can be a person's name. The add-on's name and
 * price stay for the books; run again, it changes nothing more.
 */
export const eraseAddonTexts = (container: Container, orderIds: readonly string[]) =>
  rewriteOrderLines(container, orderIds, withoutAddonTexts)
