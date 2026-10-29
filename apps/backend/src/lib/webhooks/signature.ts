import { createHmac, randomBytes } from "node:crypto"

/**
 * A webhook's signature (docs/entegrasyonlar/muhasebe.md): hex
 * HMAC-SHA256 of `timestamp + "." + body` with the subscription's secret,
 * sent as `X-Webhook-Signature: t=<timestamp>,v1=<hex>`. The receiver
 * checks it and refuses an old timestamp, so a replay fails.
 */

export const signBody = (secret: string, timestamp: number, body: string): string =>
  createHmac("sha256", secret)
    .update(`${String(timestamp)}.${body}`)
    .digest("hex")

export const signatureHeader = (secret: string, timestamp: number, body: string): string =>
  `t=${String(timestamp)},v1=${signBody(secret, timestamp, body)}`

/** A new subscription's secret: shown once, kept encrypted. */
export const newWebhookSecret = (): string => `whsec_${randomBytes(24).toString("hex")}`
