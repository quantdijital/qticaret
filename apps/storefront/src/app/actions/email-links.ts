"use server"

import { redirect } from "next/navigation"
import { isStoreApiError } from "@/lib/store-api/errors"
import { storePost } from "@/lib/store-api/server"
import { EMAIL_LINK_ENDPOINTS, linkTokenOf, outcomePath } from "@/lib/views/email-links"
import type { EmailLinkKind, EmailLinkOutcome } from "@/lib/views/email-links"

/**
 * A message's token link, once its reader pressed the page's button
 * (adr/0038 Ek 2026-11-02): the token goes to the backend, which checks it
 * again, and the page comes back saying what happened, the token out of
 * the address.
 */
async function follow(kind: EmailLinkKind, form: FormData): Promise<never> {
  const token = linkTokenOf(kind, form.get("token"))
  if (!token) {
    redirect(outcomePath(kind, "invalid"))
  }
  let outcome: EmailLinkOutcome
  try {
    const { status } = await storePost<{ status: string }>(EMAIL_LINK_ENDPOINTS[kind], { token })
    outcome = kind !== "consent" ? "done" : status === "revoked" ? "revoked" : "granted"
  } catch (error) {
    if (!isStoreApiError(error)) {
      throw error
    }
    outcome =
      error.status === 429
        ? "busy"
        : error.status >= 400 && error.status < 500
          ? "invalid"
          : "failed"
  }
  redirect(outcomePath(kind, outcome))
}

/** `/abonelik/cik`: out of the shop's campaign e-mails. Form field: `token`. */
export async function unsubscribeByLink(form: FormData): Promise<void> {
  await follow("unsubscribe", form)
}

/** `/abonelik/onay`: the consent a request asked for (double opt-in). Form field: `token`. */
export async function confirmConsentByLink(form: FormData): Promise<void> {
  await follow("consent", form)
}

/** `/stok-bildirimi/onay`: a guest's stock alert turned on. Form field: `token`. */
export async function confirmStockAlertByLink(form: FormData): Promise<void> {
  await follow("stock_alert", form)
}
