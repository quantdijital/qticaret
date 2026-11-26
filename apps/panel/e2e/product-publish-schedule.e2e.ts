import type { Page } from "@playwright/test"
import { expect, pageHeading, test } from "./support/guard"

/**
 * A draft's planned publish (S2, docs/06 "Ürün sayfası"): "Yayın tarihi"
 * in the summary plans it at Türkiye's clock, the header's badge says
 * "Planlı · …", and "Planı iptal et" takes it back. The test makes its own
 * draft, named for this run, and deletes it at the end; the plan is a day
 * ahead, so the minute job never publishes it meanwhile.
 */

async function publishAtOf(page: Page, id: string): Promise<unknown> {
  const answer = await page.request.get(`/admin/products/${id}?fields=id,status,metadata`)
  expect(answer.ok(), `GET product ${String(answer.status())}: ${await answer.text()}`).toBe(true)
  const { product } = (await answer.json()) as {
    product: { status: string; metadata: Record<string, unknown> | null }
  }
  expect(product.status).toBe("draft")
  return product.metadata?.["publish_at"] ?? null
}

async function makeDraft(page: Page): Promise<string> {
  const run = `${String(Date.now())}-${String(Math.floor(Math.random() * 1e6))}`
  const answer = await page.request.post("/admin/products", {
    data: {
      title: `Planlı Bıçak ${run}`,
      handle: `e2e-planli-bicak-${run}`,
      status: "draft",
      options: [{ title: "Boy", values: ["12 cm"] }],
      variants: [
        {
          title: "12 cm",
          manage_inventory: false,
          prices: [{ currency_code: "try", amount: 1450 }],
          options: { Boy: "12 cm" },
        },
      ],
    },
  })
  expect(
    answer.ok(),
    `POST /admin/products ${String(answer.status())}: ${await answer.text()}`
  ).toBe(true)
  return ((await answer.json()) as { product: { id: string } }).product.id
}

test.describe("planned publish", () => {
  test("plans a draft's publish, shows it, and cancels it", async ({ page, guard }) => {
    const id = await makeDraft(page)
    try {
      await page.goto(`/products/${id}`)
      await expect(pageHeading(page)).toBeVisible()
      const row = page.getByTestId("publish-schedule")
      await expect(row.getByText("Elle yayınlanır")).toBeVisible()

      // Opens at tomorrow 10:00, Türkiye's clock; planned as it stands
      await row.getByRole("button", { name: "Planla" }).click()
      const field = row.getByLabel("Yayın tarihi ve saati")
      await expect(field).toHaveValue(/T10:00$/)
      await expect(row.getByText(/Türkiye saatiyle/)).toBeVisible()
      await row.getByRole("button", { name: "Planla" }).click()

      await expect(page.getByText(/^Planlı · \d{1,2} \S+ 10:00$/).first()).toBeVisible()
      await expect(row.getByRole("button", { name: "Değiştir" })).toBeVisible()
      await expect
        .poll(async () => {
          const at = await publishAtOf(page, id)
          return typeof at === "string" ? new Date(at).getUTCHours() : null
        })
        .toBe(7)

      // Cancelled: back to by hand, nothing left on the product
      await row.getByRole("button", { name: "Planı iptal et" }).click()
      await expect(row.getByText("Elle yayınlanır")).toBeVisible()
      await expect.poll(() => publishAtOf(page, id)).toBeNull()
      await guard.assertHealthy()
    } finally {
      const gone = await page.request.delete(`/admin/products/${id}`)
      expect(gone.ok(), `DELETE product ${String(gone.status())}: ${await gone.text()}`).toBe(true)
    }
  })
})
