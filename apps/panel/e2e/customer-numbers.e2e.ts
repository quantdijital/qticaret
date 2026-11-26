import type { Page } from "@playwright/test"
import { expect, pageHeading, test } from "./support/guard"

const STATS = "/admin/customer-stats?"

/** The newest of the first few orders with a customer record: its side shows their history. */
async function openOrderWithCustomer(page: Page): Promise<boolean> {
  await page.goto("/orders")
  const links = page.getByRole("table").getByRole("link")
  await expect(links.first()).toBeVisible()
  const count = Math.min(await links.count(), 5)
  for (let index = 0; index < count; index += 1) {
    await page.goto("/orders")
    await page.getByRole("table").getByRole("link").nth(index).click()
    await expect(page).toHaveURL(/\/orders\/order_/)
    await expect(pageHeading(page)).toBeVisible()
    await page.waitForLoadState("networkidle")
    if (await page.getByRole("heading", { name: "Müşteri geçmişi" }).isVisible()) {
      return true
    }
  }
  return false
}

test("shows the customers' numbers in the list, read in one go", async ({ page, guard }) => {
  const stats = page.waitForResponse((response) => response.url().includes(STATS)).catch(() => null)
  await page.goto("/customers")
  const table = page.getByRole("table")
  test.skip(
    !(await table
      .getByRole("link")
      .first()
      .isVisible({ timeout: 10_000 })
      .catch(() => false)),
    "no customers"
  )
  expect((await stats)?.status()).toBe(200)
  await expect(table.getByRole("columnheader", { name: "Toplam harcama" })).toBeVisible()
  // The average basket waits to be asked for, from "Sütunlar"
  await expect(table.getByRole("columnheader", { name: "Ortalama sepet" })).toHaveCount(0)
  await page.getByRole("button", { name: "Sütunlar" }).click()
  await page.getByRole("menuitemcheckbox", { name: "Ortalama sepet" }).click()
  await page.keyboard.press("Escape")
  await expect(table.getByRole("columnheader", { name: "Ortalama sepet" })).toBeVisible()
  // Put it back: the next run starts from the defaults
  await page.getByRole("button", { name: "Sütunlar" }).click()
  await page.getByRole("menuitemcheckbox", { name: "Ortalama sepet" }).click()
  await page.keyboard.press("Escape")
  await expect(table.getByRole("columnheader", { name: "Ortalama sepet" })).toHaveCount(0)

  await table.getByRole("link").first().click()
  await expect(page).toHaveURL(/\/customers\/cus_/)
  await expect(page.getByTestId("customer-figures")).toBeVisible()
  await expect(page.getByTestId("customer-figures").getByText("Toplam harcama")).toBeVisible()
  await guard.assertHealthy()
})

test("shows the customer's history beside an order", async ({ page, guard }) => {
  test.skip(!(await openOrderWithCustomer(page)), "no order with a customer record")
  const card = page.locator("section", {
    has: page.getByRole("heading", { name: "Müşteri geçmişi" }),
  })
  await expect(card.getByTestId("customer-figures")).toBeVisible()
  await expect(card.getByText("Ortalama sepet")).toBeVisible()
  // The customer's other orders are linked once, from the customer card above
  await expect(card.getByRole("link")).toHaveCount(0)
  await expect(page.getByRole("link", { name: "Bu müşterinin diğer siparişleri" })).toHaveAttribute(
    "href",
    /\/orders\?customer=cus_/
  )
  // Where the order came from shows only when the storefront recorded it
  const origin = page.getByTestId("order-origin")
  if (await origin.isVisible()) {
    await expect(origin.getByText("Kaynak")).toBeVisible()
  }
  await guard.assertHealthy()
})
