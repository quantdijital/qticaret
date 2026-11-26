import type { APIRequestContext, Locator, Page } from "@playwright/test"
import { expect, test } from "./support/guard"

/**
 * "Kargo ücreti" as one question (the owner, 2026-11-26): an answer
 * saved in place under Settings > Shipping lands on the main option and
 * the free shipping total, the storefront's quote for a cart follows it,
 * and the promotions page's line links back to the card. The main
 * option's amount, the threshold and the main option's id are put back.
 */

interface ShopOption {
  id: string
  name: string
  carrier: string | null
  pricing: string
  amount: string | null
}

const OPTIONS = "/admin/shipping-setup/options"
const PROMOTIONS = "/admin/platform-settings/promotions"
const SHIPPING = "/admin/platform-settings/shipping"

async function json<T>(page: Page, url: string): Promise<T> {
  const answer = await page.request.get(url)
  expect(answer.ok(), `GET ${url} ${String(answer.status())}`).toBe(true)
  return (await answer.json()) as T
}

const options = async (page: Page) => (await json<{ options: ShopOption[] }>(page, OPTIONS)).options
const threshold = async (page: Page) =>
  (await json<{ values: { free_shipping_threshold: number | null } }>(page, PROMOTIONS)).values
    .free_shipping_threshold
const primaryId = async (page: Page) =>
  (await json<{ values: { primary_option_id?: string | null } }>(page, SHIPPING)).values
    .primary_option_id ?? null

/** The shop's publishable key, as the storefront sends it. */
async function publishableKey(page: Page): Promise<string> {
  const { api_keys: keys } = await json<{
    api_keys: { title: string; token: string; revoked_at?: string | null }[]
  }>(page, "/admin/api-keys?type=publishable&limit=50")
  const live = keys.filter((key) => !key.revoked_at)
  const key = live.find((each) => each.title === "Demo storefront") ?? live[0]
  expect(key, "the shop has a publishable key").toBeDefined()
  return key?.token ?? ""
}

/** One storefront call, as its server makes it: what it answered. */
type StoreCall = (path: string, data?: unknown) => Promise<{ status: number; body: unknown }>

/**
 * Store calls from a fresh context each, with no cookie: a store write
 * carrying a session cookie must come from the storefront's origin
 * (api/http/csrf.ts), and Medusa answers a store read with one.
 */
function storeCalls(
  newContext: (options: { baseURL?: string }) => Promise<APIRequestContext>,
  baseURL: string | undefined,
  key: string
): StoreCall {
  return async (path, data) => {
    const context = await newContext(baseURL === undefined ? {} : { baseURL })
    try {
      const headers = { "x-publishable-api-key": key }
      const answer =
        data === undefined
          ? await context.get(path, { headers })
          : await context.post(path, { headers, data })
      return { status: answer.status(), body: (await answer.json()) as unknown }
    } finally {
      await context.dispose()
    }
  }
}

/** A guest cart of one unit of the shop's oldest product, as the storefront makes it. */
async function cart(store: StoreCall): Promise<string> {
  const regions = (await store("/store/regions")).body as { regions: { id: string }[] }
  const products = (await store("/store/products?limit=1&order=created_at&fields=id,variants.id"))
    .body as { products: { variants: { id: string }[] }[] }
  const region = regions.regions[0]
  const variant = products.products[0]?.variants[0]
  expect(region && variant, "the shop sells a product in a region").toBeTruthy()
  const made = await store("/store/carts", {
    region_id: region?.id,
    items: [{ variant_id: variant?.id, quantity: 1 }],
  })
  expect(made.status, `POST /store/carts ${JSON.stringify(made.body)}`).toBe(200)
  return (made.body as { cart: { id: string } }).cart.id
}

/** The server's price of the option for the cart, in lira: what checkout charges. */
async function quote(store: StoreCall, cartId: string, optionId: string): Promise<number> {
  const answer = await store(`/store/shipping-options/${optionId}/calculate`, {
    cart_id: cartId,
    data: {},
  })
  expect(answer.status, `calculate ${JSON.stringify(answer.body)}`).toBe(200)
  return (answer.body as { shipping_option: { amount: number } }).shipping_option.amount
}

const feeCard = (page: Page): Locator => page.locator("#free-shipping")

async function answer(page: Page, mode: RegExp, fill: Record<string, string> = {}) {
  const card = feeCard(page)
  await card.getByRole("radio", { name: mode }).click()
  for (const [label, value] of Object.entries(fill)) {
    await card.getByLabel(new RegExp(`^${label}`)).fill(value)
  }
  await card.getByRole("button", { name: "Kaydet" }).click()
}

test.describe.serial("shipping fee", () => {
  test("switches the answer and the storefront's quote follows it", async ({
    page,
    guard,
    playwright,
    baseURL,
  }) => {
    const before = { options: await options(page), threshold: await threshold(page) }
    const savedPrimary = await primaryId(page)
    await page.goto("/settings/shipping?part=options")
    await expect(feeCard(page).getByText("Kargo ücreti").first()).toBeVisible()
    const named = (await feeCard(page).getByTestId("shipping-fee-primary").textContent()) ?? ""
    const main = before.options.find((each) => named.includes(`"${each.name}"`))
    test.skip(main?.pricing !== "flat", "the main option is priced by a carrier, not here")
    if (!main) {
      return
    }
    const key = await publishableKey(page)
    // No storage state: not the panel's signed-in one
    const store = storeCalls(
      (options) =>
        playwright.request.newContext({ ...options, storageState: { cookies: [], origins: [] } }),
      baseURL,
      key
    )
    const cartId = await cart(store)
    try {
      // A flat fee: every order pays it, no threshold
      await answer(page, /^Sabit ücret/, { "Sipariş başına kargo ücreti": "77" })
      await expect.poll(() => primaryId(page)).toBe(main.id)
      await expect
        .poll(async () => (await options(page)).find(({ id }) => id === main.id)?.amount)
        .toBe("77.00")
      expect(await threshold(page)).toBeNull()
      expect(await quote(store, cartId, main.id)).toBe(77)

      // Free above ₺1: the cart is past it, so it ships free; the promotions page says so
      await answer(page, /^Belli tutarın üstünde ücretsiz/, {
        "Ücretsiz kargo sınırı": "1",
        "Sınırın altında kargo ücreti": "77",
      })
      await expect.poll(() => threshold(page)).toBe(1)
      expect(await quote(store, cartId, main.id)).toBe(0)
      await page.goto("/promotions")
      await expect(page.getByTestId("free-shipping-summary")).toHaveText(
        "Kargo bedava eşiği: ₺1,00"
      )
      await page.getByRole("link", { name: "Kargo ayarlarında değiştir" }).click()
      await expect(page).toHaveURL(/\/settings\/shipping\?part=options#free-shipping$/)
      await expect(
        feeCard(page).getByRole("radio", { name: /^Belli tutarın üstünde ücretsiz/ })
      ).toBeChecked()

      // Free on every order: the main option at 0, no threshold
      await answer(page, /^Tüm siparişlerde kargo ücretsiz/)
      await expect
        .poll(async () => (await options(page)).find(({ id }) => id === main.id)?.amount)
        .toBe("0.00")
      expect(await threshold(page)).toBeNull()
      expect(await quote(store, cartId, main.id)).toBe(0)
      await guard.assertHealthy()
    } finally {
      const repriced = await page.request.post(`${OPTIONS}/${main.id}`, {
        data: { amount: Number(main.amount ?? 0) },
      })
      expect(repriced.ok()).toBe(true)
      const restored = await page.request.post(PROMOTIONS, {
        data: { free_shipping_threshold: before.threshold },
      })
      expect(restored.ok()).toBe(true)
      const primary = await page.request.post(SHIPPING, {
        data: { primary_option_id: savedPrimary },
      })
      expect(primary.ok()).toBe(true)
    }
  })
})
