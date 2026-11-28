import type { Page } from "@playwright/test"
import { expect, test } from "./support/guard"

/**
 * "Kargo ücreti" > "Belli tutarın üstünde ücretsiz" > "Koşul"
 * (WooCommerce's "Free shipping requires"): chosen in place, kept as
 * `promotions.free_shipping_condition`, and said on the promotions page.
 * The server's hold on it is the backend's HTTP tests'. The threshold,
 * the condition, the main option's amount and id are put back.
 */

interface ShopOption {
  id: string
  name: string
  pricing: string
  amount: string | null
}

interface PromotionValues {
  free_shipping_threshold: number | null
  free_shipping_condition?: string
}

const OPTIONS = "/admin/shipping-setup/options"
const PROMOTIONS = "/admin/platform-settings/promotions"
const SHIPPING = "/admin/platform-settings/shipping"

async function json<T>(page: Page, url: string): Promise<T> {
  const answer = await page.request.get(url)
  expect(answer.ok(), `GET ${url} ${String(answer.status())}`).toBe(true)
  return (await answer.json()) as T
}

const promotions = async (page: Page) =>
  (await json<{ values: PromotionValues }>(page, PROMOTIONS)).values
const primaryId = async (page: Page) =>
  (await json<{ values: { primary_option_id?: string | null } }>(page, SHIPPING)).values
    .primary_option_id ?? null

test("sets what free shipping needs beside the total, said on the promotions page", async ({
  page,
  guard,
}) => {
  const before = await promotions(page)
  const savedPrimary = await primaryId(page)
  const all = (await json<{ options: ShopOption[] }>(page, OPTIONS)).options
  await page.goto("/settings/shipping?part=options")
  const card = page.locator("#free-shipping")
  await expect(card.getByText("Kargo ücreti").first()).toBeVisible()
  const named = (await card.getByTestId("shipping-fee-primary").textContent()) ?? ""
  const main = all.find((each) => named.includes(`"${each.name}"`))
  test.skip(main?.pricing !== "flat", "the main option is priced by a carrier, not here")
  if (!main) {
    return
  }
  try {
    await card.getByRole("radio", { name: /^Belli tutarın üstünde ücretsiz/ }).click()
    await card.getByLabel(/^Ücretsiz kargo sınırı/).fill("1500")
    await card.getByLabel(/^Sınırın altında kargo ücreti/).fill("77")
    await card.getByTestId("free-shipping-condition").click()
    await page.getByRole("option", { name: "Tutar ve ücretsiz kargo kuponu" }).click()
    await expect(card.getByText(/Sınırın altında kupon kabul edilmez/)).toBeVisible()
    await card.getByRole("button", { name: "Kaydet" }).click()
    await expect
      .poll(async () => (await promotions(page)).free_shipping_condition)
      .toBe("amount_and_coupon")
    expect((await promotions(page)).free_shipping_threshold).toBe(1500)

    // After a reload the card shows what the server kept
    await page.reload()
    await expect(card.getByTestId("free-shipping-condition")).toHaveText(
      "Tutar ve ücretsiz kargo kuponu"
    )

    await page.goto("/promotions")
    await expect(page.getByTestId("free-shipping-coupon-summary")).toHaveText(
      "Ücretsiz kargo kuponları: ₺1.500,00 ve üzeri sepette geçerli"
    )
    await guard.assertHealthy()
  } finally {
    const repriced = await page.request.post(`${OPTIONS}/${main.id}`, {
      data: { amount: Number(main.amount ?? 0) },
    })
    expect(repriced.ok()).toBe(true)
    const restored = await page.request.post(PROMOTIONS, {
      data: {
        free_shipping_threshold: before.free_shipping_threshold,
        free_shipping_condition: before.free_shipping_condition ?? "amount_or_coupon",
      },
    })
    expect(restored.ok()).toBe(true)
    const primary = await page.request.post(SHIPPING, {
      data: { primary_option_id: savedPrimary },
    })
    expect(primary.ok()).toBe(true)
  }
})
