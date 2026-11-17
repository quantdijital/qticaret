"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import type { ActionResult } from "@qticaret/ui"
import { currentCustomer, rememberAddress } from "@/lib/account/auth"
import { addressFromForm } from "@/lib/checkout/address-form"
import { isStoreApiError } from "@/lib/store-api/errors"
import { storeDelete } from "@/lib/store-api/server"

/** Drops one of the signed-in customer's saved addresses (Medusa checks it is theirs). */
export async function removeAddress(form: FormData): Promise<void> {
  const parsed = z
    .string()
    .regex(/^cuaddr_[0-9A-Za-z]{10,64}$/)
    .safeParse(form.get("id"))
  if (parsed.success) {
    await storeDelete(`/store/customers/me/addresses/${encodeURIComponent(parsed.data)}`).catch(
      (error: unknown) => {
        if (!isStoreApiError(error)) {
          throw error
        }
      }
    )
  }
  revalidatePath("/hesap/adresler")
}

/**
 * One more address in the signed-in customer's book (D8): the checkout's
 * form without the e-mail (the account's own stands in for the check), the
 * selects' ids turned into the names the backend checks again (tr-address).
 */
export async function addAddress(_state: ActionResult, form: FormData): Promise<ActionResult> {
  const customer = await currentCustomer()
  if (!customer) {
    redirect("/hesap/giris?sonra=%2Fhesap%2Fadresler")
  }
  form.set("email", customer.email)
  const parsed = await addressFromForm(form)
  if (!parsed.ok) {
    return { ok: false, error: parsed.error }
  }
  const { first_name, last_name, phone, address_1, address_2, city, province, postal_code } =
    parsed.value
  try {
    await rememberAddress({
      first_name,
      last_name,
      phone,
      address_1,
      address_2,
      city,
      province,
      postal_code,
      country_code: "tr",
    })
  } catch (error) {
    if (!isStoreApiError(error)) {
      throw error
    }
    return { ok: false, error: "checkout.address_invalid" }
  }
  revalidatePath("/hesap/adresler")
  redirect("/hesap/adresler")
}
