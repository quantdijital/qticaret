import { parseEnv } from "../env"

/** What an issued invoice leaves on its charge (adr/0061 §2 `charge`). */
export interface IssuedInvoice {
  number: string
  ettn: string
  pdf_url: string | null
}

/** A paid charge as the issuer sees it: no personal data beyond the shop's id. */
export interface InvoiceableCharge {
  id: string
  tenant_id: string
  amount: number
  currency_code: string
  paid_on: string
  period_start: string
  period_end: string
}

/**
 * The platform's own e-invoice for a paid subscription (adr/0061 §7, Ek
 * C16). Designed, off: Quant Dijital is not founded yet, so the only
 * implementation is `none` and a charge's invoice fields stay empty. The
 * next one (Paraşüt, adr/0034's client moved to server-kit) arrives with
 * the company; `CP_INVOICING` then names it.
 */
export interface SubscriptionInvoiceIssuer {
  readonly kind: "none"
  /** The invoice for a charge just paid; null when none is issued. */
  issue(charge: InvoiceableCharge): Promise<IssuedInvoice | null>
}

export const noInvoices: SubscriptionInvoiceIssuer = {
  kind: "none",
  issue: () => Promise.resolve(null),
}

/** The issuer `CP_INVOICING` names; `off` (the default) is `none`. */
export function invoiceIssuer(): SubscriptionInvoiceIssuer {
  // The env schema accepts `off` only until there is a company to invoice from
  parseEnv()
  return noInvoices
}
