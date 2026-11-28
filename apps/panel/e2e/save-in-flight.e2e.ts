import type { Page } from "@playwright/test"
import { expect, pageHeading, test } from "./support/guard"

/**
 * What is typed while "Kaydet" is on its way stays (docs/06 "Ürün
 * sayfası"): on a slow network the product's parcel is saved, the length
 * typed meanwhile is kept, and "Kaydet" is active again for it. Every
 * change is put back as it was before the test ends.
 */

interface Parcel {
  id: string
  weight: number | null
  length: number | null
}

async function parcels(page: Page): Promise<Parcel[]> {
  const answer = await page.request.get(
    "/admin/products?limit=50&order=created_at&fields=id,weight,length"
  )
  expect(answer.ok()).toBe(true)
  return ((await answer.json()) as { products: Parcel[] }).products
}

async function parcel(page: Page, id: string): Promise<Parcel> {
  const answer = await page.request.get(`/admin/products/${id}?fields=id,weight,length`)
  expect(answer.ok()).toBe(true)
  return ((await answer.json()) as { product: Parcel }).product
}

const headerSave = (page: Page) => page.getByRole("group", { name: "Sayfanın kaydı" })
const saveButton = (page: Page) =>
  headerSave(page).getByRole("button", { name: "Kaydet", exact: true })
const saved = (page: Page) =>
  headerSave(page).getByRole("button", { name: "Kaydedildi", exact: true })

test("keeps a field typed while the save is on its way, and Kaydet is active again", async ({
  page,
  guard,
}) => {
  const first = (await parcels(page))[0]
  test.skip(!first, "the demo shop has no product")
  const id = first?.id ?? ""
  await page.goto(`/products/${id}`)
  await expect(pageHeading(page)).toBeVisible()
  const tab = page.locator("#product-data-tab-shipping")
  test.skip((await tab.count()) === 0, "the product has no parcel (digital or a service)")
  await tab.click()
  const weight = page.locator("#detail-weight")
  const length = page.locator("#detail-length")
  await expect(weight).toBeEditable()
  const weightShown = await weight.inputValue()
  const lengthShown = await length.inputValue()
  const before = await parcel(page, id)

  // The product's save answers late: a slow network
  let held = 0
  await page.route(`**/admin/products/${id}`, async (route) => {
    if (route.request().method() === "POST") {
      held += 1
      await new Promise((resolve) => setTimeout(resolve, 2_000))
    }
    await route.fallback()
  })

  await weight.fill("777")
  await saveButton(page).click()
  await expect.poll(() => held).toBe(1)
  // Typed while the server has not answered yet
  await length.fill("33")
  await expect.poll(async () => (await parcel(page, id)).weight).not.toBe(before.weight)
  await expect(saveButton(page)).toBeEnabled()
  await expect(weight).toHaveValue("777")
  await expect(length).toHaveValue("33")
  expect((await parcel(page, id)).length).toBe(before.length)
  await page.unroute(`**/admin/products/${id}`)

  // Back as it was
  await weight.fill(weightShown)
  await length.fill(lengthShown)
  await saveButton(page).click()
  await expect(saved(page)).toBeDisabled()
  await expect.poll(async () => parcel(page, id)).toEqual(before)
  await guard.assertHealthy()
})
