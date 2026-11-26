import type { Page } from "@playwright/test"
import { expect, pageHeading, test } from "./support/guard"

/**
 * Linked products (S3): two products added to "Benzer / daha iyi
 * ürünler" on the "Bağlantılı ürünler" tab, saved by the page header's
 * "Kaydet", read back in order after a reload, then one removed. The test
 * makes its own draft products and deletes them.
 */

const RUN = `${String(Date.now())}-${String(Math.floor(Math.random() * 1e6))}`

async function makeProduct(page: Page, title: string): Promise<string> {
  const answer = await page.request.post("/admin/products", {
    data: {
      title,
      handle: `e2e-bagli-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
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

async function upsellIds(page: Page, id: string): Promise<string[]> {
  const answer = await page.request.get(`/admin/products/${id}/catalog`)
  expect(answer.ok()).toBe(true)
  return ((await answer.json()) as { upsells?: { id: string }[] }).upsells?.map((p) => p.id) ?? []
}

const headerSave = (page: Page) => page.getByRole("group", { name: "Sayfanın kaydı" })

test.describe("linked products", () => {
  test("adds two, saves with the header, reads them back in order, removes one", async ({
    page,
    guard,
  }) => {
    const titles = [`Bagli Ana ${RUN}`, `Bagli Bir ${RUN}`, `Bagli Iki ${RUN}`]
    const ids: string[] = []
    try {
      for (const title of titles) {
        ids.push(await makeProduct(page, title))
      }
      const [main, first, second] = ids as [string, string, string]
      await page.goto(`/products/${main}`)
      await expect(pageHeading(page)).toBeVisible()
      await page.locator("#product-data").getByRole("tab", { name: "Bağlantılı ürünler" }).click()

      const picker = page.getByRole("combobox", { name: "Benzer / daha iyi ürünler" })
      for (const title of [titles[2], titles[1]] as string[]) {
        await picker.click()
        await page.getByPlaceholder("Ürün ekle").last().fill(title)
        await page.getByRole("option", { name: title }).click()
      }
      const list = page.getByRole("list", { name: "Benzer / daha iyi ürünler" })
      await expect(list.getByRole("listitem")).toHaveCount(2)
      // The second added goes first by its arrow
      await list.getByRole("button", { name: `${titles[1] ?? ""}: yukarı taşı` }).click()
      await headerSave(page).getByRole("button", { name: "Kaydet", exact: true }).click()
      await expect.poll(() => upsellIds(page, main)).toEqual([first, second])

      await page.reload()
      await page.locator("#product-data").getByRole("tab", { name: "Bağlantılı ürünler" }).click()
      await expect(list.getByRole("listitem")).toHaveText([
        new RegExp(titles[1] ?? ""),
        new RegExp(titles[2] ?? ""),
      ])
      await list.getByRole("button", { name: `${titles[1] ?? ""}: kaldır` }).click()
      await headerSave(page).getByRole("button", { name: "Kaydet", exact: true }).click()
      await expect.poll(() => upsellIds(page, main)).toEqual([second])
      await guard.assertHealthy()
    } finally {
      for (const id of ids) {
        const gone = await page.request.delete(`/admin/products/${id}`)
        expect(gone.ok()).toBe(true)
      }
    }
  })
})
