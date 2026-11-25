import type { Page } from "@playwright/test"
import { expect, pageHeading, test } from "./support/guard"

/** The newest order whose customer has an account: its card links to their other orders. */
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
    if (await page.getByRole("link", { name: "Bu müşterinin diğer siparişleri" }).isVisible()) {
      return true
    }
  }
  return false
}

test("lists one customer's orders from the order's card, the filter a removable chip", async ({
  page,
  guard,
}) => {
  test.skip(!(await openOrderWithCustomer(page)), "no order of a registered customer")
  await page.getByRole("link", { name: "Bu müşterinin diğer siparişleri" }).click()
  await expect(page).toHaveURL(/\/orders\?.*customer=cus_/)
  const chip = page.locator("[data-filter-bar]").getByText("Müşteri:")
  await expect(chip).toBeVisible()
  await expect(page.getByRole("table").getByRole("link").first()).toBeVisible()
  await page.getByRole("button", { name: "Müşteri filtresini kaldır" }).click()
  await expect(page).not.toHaveURL(/customer=/)
  await expect(chip).toBeHidden()
  await guard.assertHealthy()
})

test("changes the order's e-mail in its card, and puts it back", async ({ page, guard }) => {
  test.skip(!(await openOrderWithCustomer(page)), "no order of a registered customer")
  const edit = page.getByRole("button", { name: "E-postayı düzenle" })
  test.skip(!(await edit.isVisible()), "the order is canceled")
  const card = page.locator("section", { has: page.getByRole("heading", { name: "Müşteri" }) })
  const original = (await card.getByRole("link", { name: /@/ }).first().textContent()) ?? ""
  const changeTo = async (email: string) => {
    await page.getByRole("button", { name: "E-postayı düzenle" }).click()
    const form = page.getByRole("form", { name: "E-posta" })
    await form.getByLabel("E-posta").fill(email)
    await form.getByRole("button", { name: "Kaydet" }).click()
    await expect(form).toBeHidden()
    await expect(card.getByRole("link", { name: email })).toBeVisible()
  }
  await changeTo(`e2e-${String(Date.now())}@example.com`)
  // The seed's e-mail back: the test leaves the order as it found it
  await changeTo(original.trim())
  await guard.assertHealthy()
})
