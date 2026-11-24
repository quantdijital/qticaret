"use server"

import { z } from "zod"
import type { PlaceOrderResult } from "@qticaret/ui"
import { gateAsk, gated } from "@/lib/store-api/gate"
import { isStoreApiError } from "@/lib/store-api/errors"
import { storeCall } from "@/lib/store-api/server"

/**
 * The newsletter box's consent text, by version (adr/0038 §2): changed
 * whenever `footer.newsletter_text` changes, so the proof names the words.
 */
const NEWSLETTER_TEXT_VERSION = "bulten-1"

/** What the form's consent box sends once ticked (the theme's `NewsletterForm`). */
const CONSENT_GIVEN = "1"

const Subscription = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  // The box's `required` is only the browser's word: no tick, no subscription (İYS, adr/0038)
  consent: z.literal(CONSENT_GIVEN),
  challenge: z
    .string()
    .regex(/^[\w.-]{1,300}$/)
    .optional()
    .or(z.literal("").transform(() => undefined)),
})

/**
 * The footer's newsletter box: the backend mails the address a link that
 * confirms the consent (double opt-in); the answer is the same for every
 * address.
 */
export async function subscribeNewsletter(
  _state: PlaceOrderResult,
  form: FormData
): Promise<PlaceOrderResult> {
  const parsed = Subscription.safeParse(Object.fromEntries(form))
  if (!parsed.success) {
    const unticked = parsed.error.issues.every((issue) => issue.path[0] === "consent")
    return {
      ok: false,
      error: unticked ? "newsletter.consent_required" : "newsletter.email_invalid",
      challenge: null,
    }
  }
  const { email } = parsed.data
  try {
    await storeCall("/store/newsletter", {
      method: "POST",
      body: { email, text_version: NEWSLETTER_TEXT_VERSION },
      ...gated(form),
    })
  } catch (error) {
    const asked = gateAsk(error)
    if (asked) {
      return asked
    }
    if (isStoreApiError(error) && error.status === 429) {
      return { ok: false, error: "newsletter.rate_limited", challenge: null }
    }
    if (isStoreApiError(error) && error.status === 400) {
      return { ok: false, error: "newsletter.email_invalid", challenge: null }
    }
    return { ok: false, error: "newsletter.failed", challenge: null }
  }
  return { ok: true, error: null, challenge: null }
}
