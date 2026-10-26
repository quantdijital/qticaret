import { model } from "@medusajs/framework/utils"

/**
 * Why a selling price was recorded (ADR-0023): a price or price list was
 * written (`price_change`), the hourly check found it different (a list's
 * start or end, an event missed: `reconcile`), the shop's first balance
 * (`opening`), or an old platform's history brought over (`import`, F14).
 */
export const PRICE_RECORD_REASONS = ["price_change", "reconcile", "opening", "import"] as const

/**
 * A variant's selling price in one currency from a moment on (F4.2,
 * ADR-0023): what a shopper without a customer group paid (`amount`, the
 * calculated price) and the regular price beside it (`original_amount`),
 * with the price list that gave it. A row is written only when either
 * changes. Append-only: the 30-day rule reads it back (F4.3).
 */
export const PriceRecord = model
  .define("price_record", {
    id: model.id({ prefix: "prcr" }).primaryKey(),
    // The order rows were written in: clocks of two processes may disagree
    seq: model.autoincrement(),
    variant_id: model.text(),
    currency_code: model.text(),
    amount: model.bigNumber(),
    original_amount: model.bigNumber(),
    price_list_id: model.text().nullable(),
    reason: model.enum([...PRICE_RECORD_REASONS]),
    // When the price began to apply; an import (F14) brings its own times
    recorded_at: model.dateTime(),
  })
  .indexes([
    { on: ["variant_id", "currency_code", "recorded_at"] },
    { on: ["variant_id", "currency_code", "seq"] },
  ])
