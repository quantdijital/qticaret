import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { serverErrorMessage } from "../../src/lib/errors/messages"
import { createAdminUser } from "../helpers/admin"
import { publishTour } from "../helpers/booking-tour"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { sheetClient } from "../helpers/sheets"
import type { SheetJob } from "../helpers/sheets"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"

jest.setTimeout(300 * 1000)

interface Preview {
  changed: number
  unchanged: number
  skipped: number
  booking_off?: number
  problems: { handle: string; message: string }[]
}

interface KindRow {
  shipping_profile?: { id: string } | null
  product_extension?: { kind: string; booking_mode: string } | null
}

/**
 * A kind change in bulk (F3.2, adr/0076 §2): the preview counts the dated
 * products it takes off dated sale, the job saves each product as its own
 * page does (flags, shipping, booking mode), and a product the flags
 * refuse is left with why.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let shop: StockShop
    const sheets = sheetClient(http, getContainer, () => admin.headers)
    const flag = (key: string, enabled: boolean) =>
      settle(http.post(`/admin/features/${key}`, { enabled }, { headers: admin.headers }))

    async function bulk(productIds: string[], change: Record<string, unknown>) {
      const queued = await settle(
        http.post<{ async_job: SheetJob }>(
          "/admin/async-jobs",
          { type: "catalog.bulk_edit", input: { product_ids: productIds, change } },
          { headers: admin.headers }
        )
      )
      expect(queued.status).toBe(202)
      return sheets.settled(queued.data.async_job.id)
    }

    const preview = (productIds: string[], change: Record<string, unknown>) =>
      settle(
        http.post<{ preview: Preview }>(
          "/admin/catalog/bulk-edit/preview",
          { product_ids: productIds, change },
          { headers: admin.headers }
        )
      )

    async function kindOf(id: string) {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "product",
          fields: [
            "shipping_profile.id",
            "product_extension.kind",
            "product_extension.booking_mode",
          ],
          filters: { id },
        })
      return data[0] as unknown as KindRow
    }

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      shop = await stockShop(getContainer())
      await flag("catalog.non_physical", true)
      await flag("catalog.booking", true)
    })
    // Flags live in settings, whose cache outlives the database reset between tests
    afterEach(async () => {
      await flag("catalog.booking", false)
      await flag("catalog.non_physical", false)
    })

    it("previews a dated product leaving dated sale, then saves the kind as the product page does", async () => {
      const knife = await stockedProduct(getContainer(), shop, "toplu-tur-bicak", 1)
      const tour = await publishTour(http, admin.headers, shop, "none")
      const ids = [knife.productId, tour.productId]

      const seen = await preview(ids, { action: "kind", kind: "physical" })
      expect(seen.status).toBe(200)
      expect(seen.data.preview).toMatchObject({
        changed: 1,
        unchanged: 1,
        skipped: 0,
        booking_off: 1,
      })
      // Nothing written by the preview
      expect((await kindOf(tour.productId)).product_extension).toMatchObject({
        kind: "service",
        booking_mode: "departure",
      })

      const job = await bulk(ids, { action: "kind", kind: "digital" })
      expect(job).toMatchObject({
        status: "succeeded",
        result_summary: { action: "kind", changed: 2, skipped: 0, failed: 0 },
      })
      const knifeNow = await kindOf(knife.productId)
      expect(knifeNow.product_extension?.kind).toBe("digital")
      // F3.2: a digital product leaves its shipping profile
      expect(knifeNow.shipping_profile ?? null).toBeNull()
      expect((await kindOf(tour.productId)).product_extension).toMatchObject({
        kind: "digital",
        booking_mode: "none",
      })
    })

    it("refuses the reserved range mode for the run, and a booking mode on another kind", async () => {
      const knife = await stockedProduct(getContainer(), shop, "toplu-tur-aralik", 1)
      for (const change of [
        { action: "kind", kind: "service", booking_mode: "range" },
        { action: "kind", kind: "physical", booking_mode: "departure" },
      ]) {
        expect((await preview([knife.productId], change)).status).toBe(400)
      }
    })

    it("leaves a product the flags refuse, with why", async () => {
      const knife = await stockedProduct(getContainer(), shop, "toplu-tur-bayrak", 1)
      await flag("catalog.non_physical", false)
      const job = await bulk([knife.productId], { action: "kind", kind: "service" })
      expect(job.result_summary).toMatchObject({ changed: 0, skipped: 1 })
      expect((job.result_summary as { problems: Preview["problems"] }).problems).toEqual([
        expect.objectContaining({
          handle: "toplu-tur-bayrak",
          message: serverErrorMessage("catalog.kind_disabled", "tr"),
        }),
      ])
      expect((await kindOf(knife.productId)).product_extension?.kind ?? "physical").toBe("physical")
    })
  },
})
