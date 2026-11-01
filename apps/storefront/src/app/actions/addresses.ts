"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { isStoreApiError } from "@/lib/store-api/errors"
import { storeDelete } from "@/lib/store-api/server"

/** Drops one of the signed-in customer's saved addresses (Medusa checks it is theirs). */
export async function removeAddress(form: FormData): Promise<void> {
  const parsed = z
    .string()
    .regex(/^cuaddr_[0-9A-Za-z]{10,64}$/)
    .safeParse(form.get("id"))
  if (parsed.success) {
    await storeDelete(`/store/customers/me/addresses/${parsed.data}`).catch((error: unknown) => {
      if (!isStoreApiError(error)) {
        throw error
      }
    })
  }
  revalidatePath("/hesap/adresler")
}
