import { createHmac } from "node:crypto"
import type { IyzicoAccount } from "./signing"

/** What the fake's answers share: the request body, lira as text, the response signature. */

export type Body = Record<string, unknown>

/** Lira ("120.5", 120.5) as kuruş, from its text: no float rounding. */
export const kurusOf = (lira: unknown): number => {
  const [whole = "0", fraction = ""] = String(lira).split(".")
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0").slice(0, 2))
}

/** A price as signatures carry it: no trailing zeros ("10.50" → "10.5", "10.0" → "10"). */
export const signedPrice = (lira: string): string =>
  lira.includes(".") ? lira.replace(/0+$/, "").replace(/\.$/, "") : lira

/** iyzico's response signature: hex HMAC-SHA256 of the values joined by ":". */
export const signAnswer = (account: IyzicoAccount, values: readonly string[]): string =>
  createHmac("sha256", account.secretKey).update(values.join(":")).digest("hex")

export const head = (body: Body) => ({
  locale: "tr",
  systemTime: Date.now(),
  conversationId: body["conversationId"],
})

export const failure = (
  body: Body,
  errorCode: string,
  errorMessage: string,
  extra: Record<string, unknown> = {}
) => ({ body: { status: "failure", errorCode, errorMessage, ...extra, ...head(body) } })
