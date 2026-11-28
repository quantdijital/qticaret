import type { Page } from "@playwright/test"
import { expect, pageHeading, test } from "./support/guard"

/**
 * Shipping classes (adr/0087 §4): one added in place under Settings >
 * Shipping > Gelişmiş, then given to a product on its "Kargo" tab and
 * saved by the page header's "Kaydet"; the tab's "ships free" switch is
 * the built-in free class (the owner, 2026-11-26). The test makes its own draft product and
 * deletes it; the shop's classes are put back as they were.
 */

interface ShippingClass {
  key: string
  name: string
  surcharge: number
}

const CLASS_NAME = `Büyük ürün ${String(Date.now())}`

async function shopClasses(page: Page): Promise<ShippingClass[]> {
  const answer = await page.request.get("/admin/platform-settings/shipping")
  expect(answer.ok()).toBe(true)
  return (
    ((await answer.json()) as { values: { shipping_classes?: ShippingClass[] } }).values
      .shipping_classes ?? []
  )
}

async function makeProduct(page: Page): Promise<string> {
  const run = `${String(Date.now())}-${String(Math.floor(Math.random() * 1e6))}`
  const answer = await page.request.post("/admin/products", {
    data: {
      title: `Kargo Sınıfı Kalemi ${run}`,
      handle: `e2e-kargo-sinifi-${run}`,
      status: "draft",
      options: [{ title: "Boy", values: ["Standart"] }],
      variants: [
        {
          title: "Standart",
          manage_inventory: false,
          prices: [{ currency_code: "try", amount: 400 }],
          options: { Boy: "Standart" },
        },
      ],
    },
  })
  expect(answer.ok(), `POST /admin/products ${String(answer.status())}`).toBe(true)
  return ((await answer.json()) as { product: { id: string } }).product.id
}

async function productClass(page: Page, id: string): Promise<string | null> {
  const answer = await page.request.get(`/admin/products/${id}/catalog`)
  expect(answer.ok()).toBe(true)
  return ((await answer.json()) as { shipping_class?: string | null }).shipping_class ?? null
}

const headerSave = (page: Page) => page.getByRole("group", { name: "Sayfanın kaydı" })
// The panel's own save ends after the server's: it refetches the product, then
// resets the form to what it sent; a click before that reset is undone by it
const saved = (page: Page) =>
  headerSave(page).getByRole("button", { name: "Kaydedildi", exact: true })

test.describe("shipping classes", () => {
  test("adds a class in place, gives it to a product, then puts both back", async ({
    page,
    guard,
  }) => {
    const before = await shopClasses(page)
    const id = await makeProduct(page)
    try {
      await page.goto("/settings/shipping?part=options")
      // Under "Gelişmiş", folded; the built-in free class is the product's switch, not a row
      const advanced = page.getByRole("region", { name: "Gelişmiş" })
      const fold = advanced.getByRole("button", { name: "Kargo sınıfları", exact: true })
      if ((await fold.getAttribute("aria-expanded")) !== "true") {
        await fold.click()
      }
      const card = page.locator("form").filter({ has: page.getByTestId("shipping-classes") })
      await expect(card.getByText("Ücretsiz kargo")).toHaveCount(0)
      await card.getByRole("button", { name: "Sınıf ekle" }).click()
      const number = before.length + 1
      await card.getByRole("textbox", { name: `${String(number)}. sınıfın adı` }).fill(CLASS_NAME)
      const surcharge = card.getByRole("spinbutton", {
        name: `${String(number)}. sınıfın ek ücreti`,
      })
      await surcharge.fill("150")
      await card.getByRole("button", { name: "Kaydet" }).click()
      await expect
        .poll(async () => (await shopClasses(page)).find((each) => each.name === CLASS_NAME))
        .toMatchObject({ surcharge: 15_000 })

      await page.goto(`/products/${id}`)
      await expect(pageHeading(page)).toBeVisible()
      await page.locator("#product-data").getByRole("tab", { name: "Kargo" }).click()
      await page.getByRole("combobox", { name: "Kargo sınıfı" }).click()
      await page.getByRole("option", { name: `${CLASS_NAME} (+₺150,00)` }).click()
      await expect(page.getByText(/kargosuna ₺150,00 eklenir/)).toBeVisible()
      await headerSave(page).getByRole("button", { name: "Kaydet", exact: true }).click()
      const key = (await shopClasses(page)).find((each) => each.name === CLASS_NAME)?.key
      await expect.poll(() => productClass(page, id)).toBe(key)
      await expect(saved(page)).toBeVisible()

      // The switch is the built-in free class; the class select steps aside
      await page.getByRole("switch", { name: "Bu ürünün kargosu ücretsiz" }).click()
      await expect(page.getByRole("combobox", { name: "Kargo sınıfı" })).toHaveCount(0)
      await headerSave(page).getByRole("button", { name: "Kaydet", exact: true }).click()
      await expect.poll(() => productClass(page, id)).toBe("free")
      await expect(saved(page)).toBeVisible()
      await guard.assertHealthy()
    } finally {
      const gone = await page.request.delete(`/admin/products/${id}`)
      expect(gone.ok()).toBe(true)
      const restored = await page.request.post("/admin/platform-settings/shipping", {
        data: { shipping_classes: before },
      })
      expect(restored.ok()).toBe(true)
    }
  })
})
