/** Every screen of the signed-in panel today (the sections still to come have none). */
export const SCREENS = [
  "/",
  "/tenants",
  "/packages",
  "/account",
  "/staff",
  "/audit-log",
  "/keys",
] as const

/** The pages before sign-in: a link without its token shows its own "invalid" page. */
export const SIGNED_OUT_SCREENS = ["/login", "/invite", "/enrol"] as const
