import "server-only"
import { redirect } from "next/navigation"
import { currentCustomer } from "./auth"
import type { StoreCustomer } from "./auth"

/** The signed-in customer, or the way to sign in and come back here. */
export async function requireCustomer(here: string): Promise<StoreCustomer> {
  const customer = await currentCustomer()
  if (!customer) {
    redirect(`/hesap/giris?sonra=${encodeURIComponent(here)}`)
  }
  return customer
}

/** A signed-in customer has no use for the sign-in pages: to the account. */
export async function awayIfSignedIn(): Promise<void> {
  if (await currentCustomer()) {
    redirect("/hesap")
  }
}
