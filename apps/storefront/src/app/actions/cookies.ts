"use server"

import { revalidatePath } from "next/cache"
import { recordCookieConsent } from "@/lib/legal/cookies"

/**
 * The cookie banner (D9): "all", "only the necessary ones", or the boxes
 * ticked; a plain form, so it answers before any script runs (and before
 * any non-necessary cookie is set).
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
}
