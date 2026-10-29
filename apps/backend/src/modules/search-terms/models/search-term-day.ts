import { model } from "@medusajs/framework/utils"

/**
 * A storefront search term's day (F11.8, adr/0039 §8): how often it was
 * searched and how often it found nothing. A count, never a shopper: no
 * IP, cart or session is kept. Days older than 180 are removed.
 */
export const SearchTermDay = model
  .define("search_term_day", {
    id: model.id({ prefix: "stday" }).primaryKey(),
    /** `YYYY-MM-DD`, as Turkey counts days. */
    day: model.text(),
    term: model.text(),
    searches: model.number().default(0),
    zero_results: model.number().default(0),
  })
  .indexes([{ on: ["day", "term"], unique: true, where: "deleted_at IS NULL" }, { on: ["term"] }])
