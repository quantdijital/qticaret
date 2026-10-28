import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { parseEnv } from "../../lib/env"
import { ValidationError } from "../../lib/errors"
import { createMailDomainCheck } from "../../lib/messaging/email/domain"

let check: ((address: string) => Promise<boolean>) | undefined

// On unless switched off; off by default under NODE_ENV=test, whose
// addresses are made up
function mailDomainCheck(): (address: string) => Promise<boolean> {
  if (check === undefined) {
    const env = parseEnv()
    const on = (env.EMAIL_DOMAIN_CHECK ?? (env.NODE_ENV === "test" ? "off" : "on")) === "on"
    check = on ? createMailDomainCheck() : () => Promise.resolve(true)
  }
  return check
}

/**
 * An address the shop will mail must have a domain that takes mail (F10
 * M9): a guest's cart, a sign-up, a stock alert. A typo or a made-up
 * domain is refused before anything is sent to it and bounces. Only a
 * clear answer from DNS refuses; a slow one lets the address through.
 */
export function requireMailDomain(field = "email") {
  return async (req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) => {
    const value = (req.body as Record<string, unknown> | undefined)?.[field]
    if (req.method !== "POST" || typeof value !== "string" || !value.includes("@")) {
      next()
      return
    }
    try {
      next(
        (await mailDomainCheck()(value))
          ? undefined
          : new ValidationError("messaging.email_domain_refuses", { field })
      )
    } catch (error) {
      next(error)
    }
  }
}
