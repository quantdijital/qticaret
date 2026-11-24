"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { formatLira } from "@qticaret/ui"
import type { ActionResult, GiftBalanceResult } from "@qticaret/ui"
import { addGiftLine, giftCardsOn, saveGiftLine } from "@/lib/cart/gift"
import type { GiftInput } from "@/lib/cart/gift"
import { gateAsk, gated } from "@/lib/store-api/gate"
import { t } from "@/lib/i18n"
import { isStoreApiError } from "@/lib/store-api/errors"
import { storeCall } from "@/lib/store-api/server"

/** Typed text as the e-mail carries it: one line; empty is none (the backend checks it again). */
const text = (max: number) =>
  z
    .string()
    .transform((value) => value.replace(/\s+/gu, " ").trim())
    .refine((value) => value.length <= max, { error: "gift_card.text_too_long" })
    .optional()
    .transform((value) => (value === "" ? undefined : value))

const Recipient = z.object({
  recipient_email: z
    .string()
    .trim()
    .max(254)
    .pipe(z.email({ error: "gift_card.recipient_email_invalid" })),
  recipient_name: text(60),
  message: text(300),
  sender_name: text(60),
})

/** The recipient's fields from a form; a refusal's message key otherwise. */
function recipientOf(
  form: FormData
): { ok: true; value: GiftInput } | { ok: false; error: string } {
  const field = (name: string) => {
    const value = form.get(name)
    return typeof value === "string" ? value : undefined
  }
  const parsed = Recipient.safeParse({
    recipient_email: field("recipient_email") ?? "",
    recipient_name: field("recipient_name"),
    message: field("message"),
    sender_name: field("sender_name"),
  })
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? ""
    return {
      ok: false,
      error: message.startsWith("gift_card.") ? message : "gift_card.recipient_email_invalid",
    }
  }
  const { recipient_email, recipient_name, message, sender_name } = parsed.data
  return {
    ok: true,
    value: {
      recipient_email,
      ...(recipient_name ? { recipient_name } : {}),
      ...(message ? { message } : {}),
      ...(sender_name ? { sender_name } : {}),
    },
  }
}

/** The backend's refusals a shopper can act on, in words; anything else is the fallback. */
function giftError(error: unknown, fallback: string): string {
  if (!isStoreApiError(error)) {
    return fallback
  }
  if (error.status === 429) {
    return "errors.too_many_requests"
  }
  const key = error.messageKey ?? ""
  return key.startsWith("gift_card.") ||
    key === "messaging.email_domain_refuses" ||
    // A payment link's cart takes no other line (adr/0051)
    key === "cart.payment_link_locked"
    ? key
    : fallback
}

const Line = z.object({
  variant_id: z.string().regex(/^variant_[0-9A-Za-z]{10,64}$/),
  quantity: z.coerce.number().int().min(1).max(99),
})

/**
 * A gift card into the cart with who it is for (adr/0025 Ek 2026-11-03):
 * the line, then its recipient; a refused recipient takes the line back.
 * Only the variant, the quantity and the recipient's words are sent.
 */
export async function addGiftToCart(_state: ActionResult, form: FormData): Promise<ActionResult> {
  const line = Line.safeParse({
    variant_id: form.get("variant_id"),
    quantity: form.get("quantity") ?? 1,
  })
  if (!line.success) {
    return { ok: false, error: "cart.variant_unavailable" }
  }
  const recipient = recipientOf(form)
  if (!recipient.ok) {
    return { ok: false, error: recipient.error }
  }
  if (!(await giftCardsOn())) {
    return { ok: false, error: "gift_card.sale_disabled" }
  }
  try {
    await addGiftLine(line.data.variant_id, line.data.quantity, recipient.value)
  } catch (error) {
    return { ok: false, error: giftError(error, "cart.add_failed") }
  }
  revalidatePath("/", "layout")
  return { ok: true, error: null }
}

const LINE_ID = z.string().regex(/^cali_[0-9A-Za-z]{10,64}$/)

/** A gift line's recipient from the cart; a plain form, a refusal back on the cart in words. */
export async function saveGiftRecipient(form: FormData): Promise<void> {
  const lineId = LINE_ID.safeParse(form.get("line_id"))
  const recipient = recipientOf(form)
  if (!lineId.success || !recipient.ok) {
    redirect(`/sepet?hata=${recipient.ok ? "cart.update_failed" : recipient.error}`)
  }
  let failed: string | null = null
  try {
    await saveGiftLine(lineId.data, recipient.value)
  } catch (error) {
    failed = giftError(error, "cart.update_failed")
  }
  revalidatePath("/", "layout")
  redirect(failed ? `/sepet?hata=${failed}` : "/sepet")
}

const Code = z.object({
  code: z.string().trim().min(4).max(64),
  challenge: z
    .string()
    .regex(/^[\w.-]{1,300}$/)
    .optional()
    .or(z.literal("").transform(() => undefined)),
})

const NO_BALANCE = { balance: null, challenge: null }

/**
 * A gift card's balance by its code (`/hediye-karti/bakiye`): the code in
 * the call's body, never in an address; past a few tries the backend asks
 * for a proof of work, which goes back to the form to solve.
 */
export async function checkGiftCardBalance(
  _state: GiftBalanceResult,
  form: FormData
): Promise<GiftBalanceResult> {
  const parsed = Code.safeParse({ code: form.get("code"), challenge: form.get("challenge") ?? "" })
  if (!parsed.success) {
    return { ok: false, error: "gift_card.code_invalid", ...NO_BALANCE }
  }
  const { code } = parsed.data
  try {
    const answer = await storeCall<{ balance: number; currency_code: string }>(
      "/store/gift-cards/balance",
      {
        method: "POST",
        body: { code },
        ...gated(form),
      }
    )
    const amount =
      answer.currency_code.toLowerCase() === "try"
        ? formatLira(answer.balance)
        : `${String(answer.balance)} ${answer.currency_code.toUpperCase()}`
    return { ok: true, error: null, balance: t("gift.balance_result", { amount }), challenge: null }
  } catch (error) {
    const asked = gateAsk(error)
    if (asked) {
      return { ...asked, balance: null }
    }
    if (isStoreApiError(error) && error.status === 404) {
      return { ok: false, error: "gift_card.unknown", ...NO_BALANCE }
    }
    return { ok: false, error: giftError(error, "gift.balance_failed"), ...NO_BALANCE }
  }
}
