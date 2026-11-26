import { parseEnv } from "../../env"
import type { Env } from "../../env"

/**
 * DHL eCommerce Türkiye (formerly MNG Kargo) keeps two identities apart
 * (docs/entegrasyonlar/dhlecommerce.md, adr/0027 Ek 2026-11-26):
 * - the platform's app at DHL's API portal (`X-IBM-Client-Id`,
 *   `X-IBM-Client-Secret`), registered once by us and read from the
 *   server's environment, never typed in by a shop;
 * - the shop's own contract: its customer number and its "Online Şube"
 *   password, written once in the panel and sealed (adr/0027).
 */

/** The platform's app at DHL eCommerce's API portal. */
export interface DhlEcomApp {
  clientId: string
  clientSecret: string
}

/** The shop's DHL eCommerce contract as the client takes it. */
export interface DhlEcomCredentials {
  customerNumber: string
  password: string
  testMode: boolean
}

/**
 * The app a fake DHL eCommerce on a developer's machine takes when the
 * server names none (`pnpm dev:dhlecommerce`): readable on purpose, real
 * DHL refuses it (docs/04).
 */
export const DHL_ECOMMERCE_DEV_APP: DhlEcomApp = {
  clientId: "gelistirme-dhl-uygulama",
  clientSecret: "gelistirme-dhl-uygulama-sirri",
}

/**
 * The platform's app; null until both of its values are set on this
 * server, so shops here cannot connect DHL eCommerce. With a fake DHL
 * eCommerce set (`DHL_ECOMMERCE_BASE_URL`, refused when deployed) and no
 * app named, the fake's development app.
 */
export function dhlEcomAppOf(
  env: Pick<
    Env,
    "DHL_ECOMMERCE_CLIENT_ID" | "DHL_ECOMMERCE_CLIENT_SECRET" | "DHL_ECOMMERCE_BASE_URL"
  > = parseEnv()
): DhlEcomApp | null {
  if (env.DHL_ECOMMERCE_CLIENT_ID && env.DHL_ECOMMERCE_CLIENT_SECRET) {
    return { clientId: env.DHL_ECOMMERCE_CLIENT_ID, clientSecret: env.DHL_ECOMMERCE_CLIENT_SECRET }
  }
  return env.DHL_ECOMMERCE_BASE_URL ? DHL_ECOMMERCE_DEV_APP : null
}

/**
 * The account as the panel stored it (adr/0027): the customer number and
 * the password sealed, the mode in the clear. Null when either is missing.
 */
export function dhlEcomCredentialsOf(
  account: { settings: Record<string, unknown>; secrets: Record<string, string> } | null
): DhlEcomCredentials | null {
  const customerNumber = account?.secrets["customer_number"]
  const password = account?.secrets["password"]
  if (!customerNumber || !password) {
    return null
  }
  return { customerNumber, password, testMode: account.settings["test_mode"] === true }
}

/** Whether shops on this server can connect DHL eCommerce: the platform's app is set (or a fake's). */
export const dhlEcomAvailable = (env?: Env): boolean => dhlEcomAppOf(env) !== null
