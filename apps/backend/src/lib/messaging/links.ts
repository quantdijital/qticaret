import { parseEnv } from "../env"

/**
 * The pages a message's token link opens (adr/0038 Ek 2026-11-02): the
 * storefront's own, in the shop's look, once the shop has a host; the
 * backend's plain pages before that, and for links already sent.
 */
export type EmailLinkKind = "unsubscribe" | "consent" | "stock_alert"

/** The storefront's pages (its `SYSTEM_ROOTS`; backend `lib/seo/paths.ts`). */
export const STOREFRONT_LINK_PATHS: Readonly<Record<EmailLinkKind, string>> = {
  unsubscribe: "/abonelik/cik",
  consent: "/abonelik/onay",
  stock_alert: "/stok-bildirimi/onay",
}

/** The backend's own pages, which the links sent before the storefront's still name. */
export const BACKEND_LINK_PATHS: Readonly<Record<EmailLinkKind, string>> = {
  unsubscribe: "/unsubscribe",
  consent: "/consents/confirm",
  stock_alert: "/stock-alerts/confirm",
}

// What a redirect carries on: the shape of every token we make, nothing longer
const FORWARDABLE = /^[\w.-]{1,200}$/

const withToken = (base: string, path: string, token: string): string =>
  `${base.replace(/\/+$/, "")}${path}?${new URLSearchParams({ t: token }).toString()}`

/**
 * A message's link with its token: the storefront's page when the shop has
 * a host (`brandOf().storefrontUrl`), else the backend's; null with neither.
 */
export function emailLinkUrl(
  kind: EmailLinkKind,
  token: string,
  storefrontUrl: string | null,
  backendUrl: string | null = parseEnv().BACKEND_URL ?? null
): string | null {
  if (storefrontUrl) {
    return withToken(storefrontUrl, STOREFRONT_LINK_PATHS[kind], token)
  }
  return backendUrl ? withToken(backendUrl, BACKEND_LINK_PATHS[kind], token) : null
}

/**
 * Where an old backend link sends its visitor once the shop has a host:
 * the storefront's page, the token carried over when it has a token's
 * shape (the page itself says a broken one is broken).
 */
export function storefrontLinkTarget(
  kind: EmailLinkKind,
  token: unknown,
  storefrontUrl: string
): string {
  return typeof token === "string" && FORWARDABLE.test(token)
    ? withToken(storefrontUrl, STOREFRONT_LINK_PATHS[kind], token)
    : `${storefrontUrl.replace(/\/+$/, "")}${STOREFRONT_LINK_PATHS[kind]}`
}
