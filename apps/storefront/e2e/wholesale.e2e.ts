import { randomBytes } from "node:crypto"
import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import { createTemporaryAdmin, removeTemporaryAdmin, signInAdmin } from "./admin"
import type { AdminApi } from "./admin"
import { purchasePath, stockedProduct } from "./catalog"
import { addressAndShipping, addToCart, dismissCookies, mainButton } from "./support"

/**
 * A wholesaler's way end to end (ADR-0068, slice 5). Staff open the
 * account with its password through the admin API (the panel's own call,
 * a temporary owner), with a price of the wholesaler's own for the
 * product and a minimum of two units. The wholesaler signs in on the
 * storefront and sees their price without KDV; one unit in the cart keeps
 * checkout closed, two open it; they pay by bank transfer and the order
 * lands in the panel's wholesale orders under their company. Closed, the
 * account sees retail again.
 *
 * The dev shop is put back after: the flag as it was, the account deleted
 * (its order stays a wholesale order, as the bank transfer test's orders
 * stay). The customer record staff made stays, as a retail customer.
 */

const FLAG = "customers.wholesale"
const COMPANY = "Uçtan Uca Toptan Ltd"
const MINIMUM = 2

const LIRA = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
/** As the storefront writes kuruş: "1.299,90 TL". */
const lira = (kurus: number) => `${LIRA.format(kurus / 100)} TL`

interface Account {
  id: string
  status: string
  staff_login: boolean
}

interface Board {
  orders: { id: string; wholesaler: { id: string; name: string | null } | null }[]
}

type Undo = () => Promise<unknown>

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/hesap/giris")
  await dismissCookies(page)
  await page.fill("#email", email)
  await page.fill("#password", password)
  await mainButton(page, "Giriş yap").click()
  await expect(page).not.toHaveURL(/\/hesap\/giris/, { timeout: 15_000 })
}

test("staff open a wholesaler who signs in, sees their price, meets the minimum and orders at wholesale", async ({
  page,
}) => {
  // Medusa's CLI makes and removes the run's admin (seconds each)
  test.setTimeout(240_000)
  const admin = createTemporaryAdmin()
  let api: AdminApi | null = null
  const undo: Undo[] = []
  try {
    api = await signInAdmin(admin)
    const shop = api
    const { features } = await shop.get<{ features: { key: string; enabled: boolean }[] }>(
      "/admin/features"
    )
    if (features.find((each) => each.key === FLAG)?.enabled !== true) {
      await shop.post(`/admin/features/${FLAG}`, { enabled: true })
      undo.push(() => shop.post(`/admin/features/${FLAG}`, { enabled: false }))
    }
    const product = await stockedProduct()

    // 1. Staff open the wholesaler with a password, and give them their own price
    const email = `e2e-toptan-${String(Date.now())}@example.com`
    const password = `Toptan-${randomBytes(12).toString("base64url")}`
    const { account } = await shop.post<{ account: Account }>("/admin/wholesale/accounts", {
      email,
      contact_name: "Uçtan Uca",
      company_name: COMPANY,
      own_prices: true,
      min_quantity: MINIMUM,
      password,
    })
    undo.push(() => shop.del(`/admin/wholesale/accounts/${account.id}`))
    expect(account).toMatchObject({ status: "active", staff_login: true })
    const net = Math.max(100, Math.round(product.variant.kurus / 2))
    await shop.post(`/admin/wholesale/accounts/${account.id}/prices`, {
      set: [{ variant_id: product.variant.id, net: (net / 100).toFixed(2) }],
    })

    // 2. They sign in and see their own price, without KDV
    await signIn(page, email, password)
    await page.goto(purchasePath(product))
    const main = page.getByRole("main")
    await expect(main.getByText("Toptan fiyat · KDV hariç").first()).toBeVisible()
    await expect(main.getByText(lira(net), { exact: true }).first()).toBeVisible()

    // 3. One unit: checkout stays closed with the minimum's words; two open it
    await addToCart(page)
    await page.goto("/sepet")
    const short = `Toptan siparişte en az ${String(MINIMUM)} adet gerekir; sepetinizde 1 adet var.`
    await expect(main.getByText(short).first()).toBeVisible()
    await main.getByRole("button", { name: "Adedi artır" }).first().click()
    await expect(main.getByText(short)).toHaveCount(0)

    // 4. Bank transfer, to the order page
    await page.goto("/odeme")
    await addressAndShipping(page, {
      email,
      first_name: "Uçtan",
      last_name: "Uca",
      phone: "05321234567",
    })
    await page.locator('input[value="pp_bank-transfer_bank-transfer"]').check()
    const accept = page.locator('input[name="accept"]')
    if (await accept.count()) {
      await accept.check()
    }
    await mainButton(page, "Siparişi tamamla").click()
    await expect(page).toHaveURL(/\/siparis\/order_[0-9A-Z]+/, { timeout: 30_000 })
    await expect(page.locator("h1")).toHaveText("Teşekkürler, siparişiniz alındı")
    const orderId = /\/siparis\/(order_[0-9A-Z]+)/.exec(page.url())?.[1] ?? ""

    // 5. The order is in the panel's wholesale orders, under the company; not in the retail list
    const accountId = account.id
    await expect
      .poll(
        async () =>
          (
            await shop.get<Board>(
              `/admin/order-board?stage=all&segment=wholesale&wholesaler=${accountId}`
            )
          ).orders.find((row) => row.id === orderId)?.wholesaler?.name ?? null,
        { timeout: 30_000 }
      )
      .toBe(COMPANY)
    const retail = await shop.get<Board>(
      `/admin/order-board?stage=all&q=${encodeURIComponent(email)}`
    )
    expect(retail.orders.map((row) => row.id)).not.toContain(orderId)

    // 6. Closed, the account sees retail prices again
    await shop.post(`/admin/wholesale/accounts/${accountId}/deactivate`, {})
    await page.goto(purchasePath(product))
    await expect(main.getByText(lira(product.variant.kurus), { exact: true }).first()).toBeVisible()
    await expect(main.getByText("Toptan fiyat · KDV hariç")).toHaveCount(0)
  } finally {
    try {
      await cleanUp(api, undo)
    } finally {
      removeTemporaryAdmin(admin.email)
    }
  }
})

/** The account deleted, the flag as it was; every step tried even if one fails. */
async function cleanUp(api: AdminApi | null, undo: Undo[]): Promise<void> {
  if (!api) {
    return
  }
  const errors: unknown[] = []
  for (const step of undo.reverse()) {
    await step().catch((error: unknown) => errors.push(error))
  }
  await api.dispose().catch((error: unknown) => errors.push(error))
  if (errors.length > 0) {
    throw new AggregateError(errors, "wholesale e2e: cleaning up failed")
  }
}
