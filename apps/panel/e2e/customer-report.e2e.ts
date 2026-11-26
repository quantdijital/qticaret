import { expect, pageHeading, test } from "./support/guard"

/**
 * The customers report (R1) and the customer list's export (CU2): the
 * report's tab shows its tiles, the new customers' chart and the top
 * spenders; the list offers its file to the owner. Reads only: nothing of
 * the shop's changes (the file is not made).
 */
test.describe("customers report and export", () => {
  test("shows the customers tab of the reports", async ({ page, guard }) => {
    await page.goto("/reports/customers?period=30d")
    await expect(pageHeading(page)).toBeVisible()
    await expect(page.getByRole("link", { name: "Müşteriler", exact: true }).first()).toBeVisible()
    await expect(page.getByText("Yeni müşteri", { exact: true })).toBeVisible()
    await expect(page.getByText("Tekrar gelen", { exact: true })).toBeVisible()
    await expect(page.getByRole("heading", { name: "En çok harcayan müşteriler" })).toBeVisible()
    // The sales report's file is not this tab's
    await expect(page.getByRole("button", { name: /Excel/ })).toHaveCount(0)
    await guard.assertHealthy()
  })

  test("offers the filtered list as a file", async ({ page, guard }) => {
    await page.goto("/customers?kind=guest")
    await expect(pageHeading(page)).toBeVisible()
    await page.getByRole("button", { name: "Dışa aktar" }).click()
    await expect(page.getByRole("menuitem", { name: "Excel olarak indir" })).toBeVisible()
    await expect(page.getByRole("menuitem", { name: "CSV indir" })).toBeVisible()
    await page.keyboard.press("Escape")
    await guard.assertHealthy()
  })
})
