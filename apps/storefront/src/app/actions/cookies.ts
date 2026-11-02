"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { recordCookieConsent } from "@/lib/legal/cookies"
import { COOKIE_PREFERENCES_PATH } from "@/lib/views/cookies"

/**
 * The cookie banner (D9): "all", "only the necessary ones", or the boxes
 * ticked; a plain form, so it answers before any script runs (and before
 * any non-necessary cookie is set). The same form asks again from the
 * footer's link and on `/cerez-tercihleri`, which it goes back to saying
 * the choice was saved; the place is a fixed word, never an address.
 */
export async function saveCookieChoice(form: FormData): Promise<void> {
  const choice = form.get("choice")
  const version = Number(form.get("policy_version"))
  const policy_version = Number.isInteger(version) && version > 0 ? version : null
  const all = choice === "all"
  const custom = choice === "custom"
  await recordCookieConsent({
    analytics: all || (custom && form.get("analytics") === "on"),
    marketing: all || (custom && form.get("marketing") === "on"),
    policy_version,
  })
  revalidatePath("/", "layout")
  if (form.get("return") === "preferences") {
    redirect(`${COOKIE_PREFERENCES_PATH}?kaydedildi=1`)
  }
}
