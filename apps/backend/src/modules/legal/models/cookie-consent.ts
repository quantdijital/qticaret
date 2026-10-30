import { model } from "@medusajs/framework/utils"

/**
 * A visitor's answer to the cookie banner (F13.8, adr/0041 §5): the
 * categories beyond the necessary ones, under which version of the cookie
 * policy, and when. Every answer is kept, a withdrawal too: the latest
 * counts, the earlier ones show what was allowed when. The visitor is
 * known only by a keyed hash of the storefront's own cookie.
 */
export const CookieConsent = model
  .define("cookie_consent", {
    id: model.id({ prefix: "cookc" }).primaryKey(),
    visitor_hash: model.text(),
    analytics: model.boolean(),
    marketing: model.boolean(),
    /** The cookie policy's version shown; null while the shop has published none. */
    policy_version: model.number().nullable(),
    given_at: model.dateTime(),
  })
  .indexes([
    {
      name: "IDX_cookie_consent_visitor",
      on: ["visitor_hash", "given_at"],
      where: "deleted_at IS NULL",
    },
  ])
