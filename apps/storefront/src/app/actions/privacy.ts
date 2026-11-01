"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { isStoreApiError } from "@/lib/store-api/errors"
import { storePost } from "@/lib/store-api/server"

/**
 * The signed-in customer's KVKK request (adr/0041 §6): a copy of their
 * data, or its erasure; the shop answers from the panel within 30 days.
 */
export async function requestPrivacy(form: FormData): Promise<void> {
  const kind = form.get("kind")
  if (kind !== "export" && kind !== "erasure") {
    redirect("/hesap/bilgiler")
  }
  let note = "kvkk"
  try {
    await storePost("/store/customers/me/privacy-requests", { kind })
  } catch (error) {
    if (!isStoreApiError(error)) {
      throw error
    }
    note = "kvkk-olmadi"
  }
  revalidatePath("/hesap/bilgiler")
  redirect(`/hesap/bilgiler?durum=${note}`)
}
