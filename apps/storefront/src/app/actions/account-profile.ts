"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import type { ActionResult } from "@qticaret/ui"
import { accountError } from "@/lib/account/errors"
import { storeCall, storePost } from "@/lib/store-api/server"

const Profile = z.object({
  first_name: z.string().trim().min(1).max(60),
  last_name: z.string().trim().min(1).max(60),
  phone: z
    .string()
    .transform((value) => value.replace(/[\s()-]/g, ""))
    .pipe(z.string().regex(/^$|^(?:\+90|0090|90|0)?5\d{9}$/)),
})

/** The signed-in customer's name and phone (D8); the session's key goes with the call. */
export async function saveProfile(_state: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = Profile.safeParse(Object.fromEntries(form))
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "")
    return {
      ok: false,
      error: field === "phone" ? "checkout.phone_invalid" : "checkout.name_required",
    }
  }
  try {
    await storePost("/store/customers/me", {
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name,
      phone: parsed.data.phone === "" ? null : parsed.data.phone,
    })
  } catch (error) {
    return { ok: false, error: accountError(error, "account.save_failed") }
  }
  revalidatePath("/hesap", "layout")
  return { ok: true, error: null }
}

const Consents = z.object({
  marketing_email: z.literal("on").optional(),
  marketing_sms: z.literal("on").optional(),
  marketing_version: z.string().regex(/^[\w.-]{1,40}$/),
})

/**
 * The customer's marketing consents (F10): each channel granted or
 * revoked with the text's version. An SMS grant waits for the phone's own
 * confirmation (double opt-in); the backend sends it.
 */
export async function saveConsents(_state: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = Consents.safeParse(Object.fromEntries(form))
  if (!parsed.success) {
    return { ok: false, error: "account.save_failed" }
  }
  const { marketing_email, marketing_sms, marketing_version } = parsed.data
  try {
    for (const [channel, on] of [
      ["email", marketing_email === "on"],
      ["sms", marketing_sms === "on"],
    ] as const) {
      await storeCall("/store/customers/me/consents", {
        method: "POST",
        body: { channel, status: on ? "granted" : "revoked", text_version: marketing_version },
      }).catch((error: unknown) => {
        // No phone on file: nothing to ask the SMS consent for
        if (!(channel === "sms" && !on)) {
          throw error
        }
      })
    }
  } catch (error) {
    return { ok: false, error: accountError(error, "account.save_failed") }
  }
  revalidatePath("/hesap/bilgiler")
  return { ok: true, error: null }
}
