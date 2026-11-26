import { expect, pageHeading, test } from "./support/guard"

/**
 * Cards whose contents ran past their edge on a phone (the 2026-11-26
 * audit): the SEO advisor's list of products to improve, its long button,
 * and the integrations' buttons that took the whole width. Read only.
 */
test("keeps the SEO advisor's list and button inside their card on a phone", async ({
  page,
  guard,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/settings/seo?part=advisor")
  await expect(pageHeading(page)).toBeVisible()
  await page.waitForLoadState("networkidle")
  const card = page.locator("main section", { hasText: "En çok iyileştirme bekleyen ürünler" })
  // A shop with no assessed product has no list to check
  if ((await card.count()) === 0) {
    return
  }
  const past = await card.first().evaluate((section) => {
    const edge = section.getBoundingClientRect().right
    return Array.from(section.querySelectorAll("li a, header button"))
      .filter((el) => el.getBoundingClientRect().right > edge + 1)
      .map((el) => el.textContent.trim().slice(0, 40))
  })
  expect(past).toEqual([])
  await guard.assertHealthy()
})

test("gives the integrations' buttons their own width on a phone", async ({ page, guard }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/settings/integrations")
  await expect(pageHeading(page)).toBeVisible()
  const setUp = page.getByRole("link", { name: "Ayarla" }).first()
  await expect(setUp).toBeVisible()
  const width = await setUp.evaluate((el) => el.getBoundingClientRect().width)
  // Not stretched across the card (about 300px on a phone), as in Ödeme and Kargo
  expect(width).toBeLessThan(160)
  await guard.assertHealthy()
})
