import { model } from "@medusajs/framework/utils"
import { LEGAL_KINDS } from "../../../lib/legal/tokens"

/**
 * A contract as it was made with an order (F13.2, adr/0041 §2): the
 * accepted version filled with the order's details when it was placed,
 * kept as HTML and never changed. It names the buyer and their address,
 * so it is encrypted; `html_hash` (SHA-256) shows it is the same text.
 */
export const LegalOrderCopy = model
  .define("legal_order_copy", {
    id: model.id({ prefix: "lcopy" }).primaryKey(),
    order_id: model.text(),
    kind: model.enum([...LEGAL_KINDS]),
    version: model.number(),
    document_id: model.text(),
    title: model.text(),
    html_encrypted: model.text(),
    html_hash: model.text(),
  })
  .indexes([
    {
      name: "IDX_legal_order_copy_order_kind",
      on: ["order_id", "kind"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])
