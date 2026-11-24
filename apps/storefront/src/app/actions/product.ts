"use server"

import { z } from "zod"
import type { ActionResult, PlaceOrderResult } from "@qticaret/ui"
import { gateAsk, gated } from "@/lib/store-api/gate"
import { isStoreApiError } from "@/lib/store-api/errors"
import { reviewPhotoFiles } from "@/lib/reviews/photos"
import { storeCall } from "@/lib/store-api/server"

const PRODUCT_ID = z.string().regex(/^prod_[0-9A-Za-z]{10,64}$/)

function failure(error: unknown, fallback: string): string {
  if (!isStoreApiError(error)) {
    return fallback
  }
  if (error.status === 401) {
    return "product.sign_in_first"
  }
  if (error.status === 429) {
    return "errors.too_many_requests"
  }
  // A review's photo its bytes refused: no image, too big, unreadable (adr/0037 §4 Ek 2026-11-04)
  if (error.messageKey?.startsWith("upload.") || error.messageKey === "media.not_an_image") {
    return "product.review_photos_invalid"
  }
  return error.messageKey?.startsWith("reviews.") || error.messageKey?.startsWith("questions.")
    ? error.messageKey
    : fallback
}

const Review = z.object({
  product_id: PRODUCT_ID,
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().max(100).optional(),
  body: z.string().trim().min(10).max(2000),
})

/**
 * A signed-in customer's review of a product they received (F10.6); it
 * waits for the shop. Its photos (`photos`, adr/0037 §4 Ek 2026-11-04) go
 * up first, one by one as their bytes; the review then names them.
 */
export async function writeReview(_state: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = Review.safeParse(Object.fromEntries([...form].filter(([key]) => key !== "photos")))
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "")
    return {
      ok: false,
      error: field === "rating" ? "product.rating_required" : "product.review_too_short",
    }
  }
  const photos = reviewPhotoFiles(form)
  if (photos === null) {
    return { ok: false, error: "product.review_photos_invalid" }
  }
  const { product_id, title, ...rest } = parsed.data
  try {
    const photoIds: string[] = []
    for (const photo of photos) {
      const { photo: uploaded } = await storeCall<{ photo: { id: string } }>(
        `/store/products/${encodeURIComponent(product_id)}/reviews/photos`,
        {
          method: "POST",
          rawBody: { bytes: await photo.arrayBuffer(), type: photo.type },
          timeoutMs: 30_000,
        }
      )
      photoIds.push(uploaded.id)
    }
    await storeCall(`/store/products/${encodeURIComponent(product_id)}/reviews`, {
      method: "POST",
      body: {
        ...rest,
        ...(title?.trim() ? { title: title.trim() } : {}),
        ...(photoIds.length > 0 ? { photo_ids: photoIds } : {}),
      },
      // Past a few an hour, Turnstile (adr/0044 Ek 2026-11-24)
      ...gated(form),
    })
  } catch (error) {
    return gateAsk(error) ?? { ok: false, error: failure(error, "product.review_failed") }
  }
  return { ok: true, error: null }
}

const Question = z.object({ product_id: PRODUCT_ID, body: z.string().trim().min(5).max(1000) })

/** A signed-in customer's question (F10.10); it shows once the shop answers. */
export async function askQuestion(_state: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = Question.safeParse(Object.fromEntries(form))
  if (!parsed.success) {
    return { ok: false, error: "product.question_too_short" }
  }
  try {
    await storeCall(`/store/products/${encodeURIComponent(parsed.data.product_id)}/questions`, {
      method: "POST",
      body: { body: parsed.data.body },
      ...gated(form),
    })
  } catch (error) {
    return gateAsk(error) ?? { ok: false, error: failure(error, "product.question_failed") }
  }
  return { ok: true, error: null }
}

const Alert = z.object({
  variant_id: z.string().regex(/^variant_[0-9A-Za-z]{10,64}$/),
  email: z
    .email()
    .max(254)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  challenge: z
    .string()
    .regex(/^[\w.-]{1,300}$/)
    .optional()
    .or(z.literal("").transform(() => undefined)),
})

/**
 * "Tell me when it is back" (F10.5): a signed-in customer's alert is on at
 * once; a guest's address confirms it by e-mail first. Past a few a hour
 * the backend asks for a proof of work.
 */
export async function stockAlert(
  _state: PlaceOrderResult,
  form: FormData
): Promise<PlaceOrderResult> {
  const parsed = Alert.safeParse(Object.fromEntries(form))
  if (!parsed.success) {
    return { ok: false, error: "checkout.email_invalid", challenge: null }
  }
  const { variant_id, email } = parsed.data
  try {
    await storeCall("/store/stock-alerts", {
      method: "POST",
      body: { variant_id, ...(email ? { email } : {}) },
      ...gated(form),
    })
  } catch (error) {
    const asked = gateAsk(error)
    if (asked) {
      return asked
    }
    const key = isStoreApiError(error) ? error.messageKey : null
    return {
      ok: false,
      error:
        key === "stock_alerts.in_stock" || key === "stock_alerts.not_tracked"
          ? key
          : "product.alert_failed",
      challenge: null,
    }
  }
  return { ok: true, error: null, challenge: null }
}
