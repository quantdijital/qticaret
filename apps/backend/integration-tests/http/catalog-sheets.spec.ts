import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { AUDIT_LOG_MODULE } from "../../src/modules/audit-log"
import type AuditLogModuleService from "../../src/modules/audit-log/service"
import type { SheetCell } from "../../src/lib/sheets"
import { ensureVatRegion } from "../../src/workflows/tax/region"
import { createVatRateWorkflow } from "../../src/workflows/tax/vat-rates"
import { vatStateOf } from "../../src/workflows/tax/vat-state"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { DIMENSIONS, row, sheetClient, xlsxOf } from "../helpers/sheets"
import { stockShop } from "../helpers/stock"

jest.setTimeout(600 * 1000)

/** F3.9 (adr/0018): product sheets in and out, through the worker (KK). */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY)

    const sheets = sheetClient(http, getContainer, () => admin.headers)
    const { upload } = sheets

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      await stockShop(getContainer())
    })

    it("imports a 1,000-row sheet in the worker and reports the bad rows (KK)", async () => {
      const sizes = ["XS", "S", "M", "L", "XL"]
      const rows: SheetCell[][] = []
      for (let index = 0; index < 198; index++) {
        for (const [rank, size] of sizes.entries()) {
          rows.push(
            row({
              handle: `toplu-urun-${String(index)}`,
              ...(rank === 0
                ? {
                    title: `Toplu Ürün ${String(index)}`,
                    status: "Yayında",
                    categories: "ev-ve-yasam",
                    ...DIMENSIONS,
                    seo_title: `Toplu ürün ${String(index)} — en iyisi`,
                  }
                : {}),
              option1_name: "Beden",
              option1_value: size,
              sku: `TOPLU-${String(index)}-${size}`,
              price: "1.250,50",
              stock: 3,
            })
          )
        }
      }
      for (let index = 0; index < 5; index++) {
        rows.push(row({ handle: `hatali-fiyat-${String(index)}`, title: "Hatalı", price: "on" }))
        rows.push(
          row({
            handle: `hatali-kategori-${String(index)}`,
            title: "Hatalı",
            categories: "yok-boyle",
          })
        )
      }
      expect(rows).toHaveLength(1000)
      const sheet = await xlsxOf(rows)

      const checked = await upload(sheet, "check")
      expect(checked).toMatchObject({
        status: "succeeded",
        result_summary: {
          mode: "check",
          rows: 1000,
          create: 198,
          update: 0,
          problems: 10,
          failed: 0,
        },
      })
      expect((checked.result_summary?.["seo"] as { top: unknown[] }).top.length).toBeGreaterThan(0)
      const { data: none } = await query().graph({
        entity: "product",
        fields: ["id"],
        filters: { handle: "toplu-urun-0" },
      })
      expect(none).toHaveLength(0)

      const applied = await upload(sheet, "apply")
      expect(applied).toMatchObject({
        status: "succeeded",
        result_summary: { mode: "apply", create: 198, failed: 0, problems: 10 },
      })
      // In the audit log as it started and as it ended (adr/0011)
      const entries = await getContainer()
        .resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
        .listAuditEntries({ resource_id: applied.id }, { select: ["action", "changes"] })
      expect(entries.map((entry) => entry.action).sort()).toEqual([
        "catalog.import_finished",
        "catalog.import_started",
      ])
      const report = await sheets.fileOf(applied)
      expect(report.filter((cells) => cells[2] === "Hata")).toHaveLength(10)
      expect(report.find((cells) => cells[1] === "hatali-kategori-0")?.[4]).toBe(
        "Kategorilerden biri bu tanıtıcıyla yok."
      )

      const { data } = await query().graph({
        entity: "product",
        fields: [
          "status",
          "categories.handle",
          "seo_meta.seo_title",
          "product_extension.primary_category_id",
          "variants.sku",
          "variants.prices.amount",
          "variants.prices.currency_code",
          "variants.inventory_items.inventory.location_levels.stocked_quantity",
        ],
        filters: { handle: "toplu-urun-7" },
      })
      const product = data[0] as unknown as {
        status: string
        categories: { handle: string }[]
        seo_meta: { seo_title: string }
        product_extension: { primary_category_id: string | null }
        variants: {
          prices: { amount: number }[]
          inventory_items: { inventory: { location_levels: { stocked_quantity: number }[] } }[]
        }[]
      }
      expect(product).toMatchObject({
        status: "published",
        categories: [{ handle: "ev-ve-yasam" }],
        seo_meta: { seo_title: "Toplu ürün 7 — en iyisi" },
      })
      expect(product.product_extension.primary_category_id).not.toBeNull()
      expect(product.variants).toHaveLength(5)
      expect(Number(product.variants[0]?.prices[0]?.amount)).toBe(1250.5)
      expect(
        product.variants[0]?.inventory_items[0]?.inventory.location_levels[0]?.stocked_quantity
      ).toBe(3)
    })

    it("reads the CSV Turkish Excel saves, Windows-1254 and `;`", async () => {
      // "Tanıtıcı;Urun adı;Fiyat (TRY)" and "celik-tava;Çelik Tava;199,90": ı is FD, Ç is C7
      const csv = Buffer.concat([
        Buffer.from([0x54, 0x61, 0x6e, 0xfd, 0x74, 0xfd, 0x63, 0xfd, 0x3b]),
        Buffer.from("Urun ad"),
        Buffer.from([0xfd]),
        Buffer.from(";Fiyat (TRY)\ncelik-tava;"),
        Buffer.from([0xc7]),
        Buffer.from("elik Tava;199,90\n"),
      ])
      const checked = await upload(csv, "check", "text/csv")
      expect(checked.result_summary).toMatchObject({ create: 1, problems: 0 })
      const report = await sheets.fileOf(checked)
      expect(report.find((cells) => cells[1] === "celik-tava")?.[2]).toBe("Eklenecek")
    })

    it("takes a product's KDV rate by name or percentage, and stops a row with an unknown one", async () => {
      const container = getContainer()
      const regionId = await ensureVatRegion(container)
      // A shop's bootstrap may have made the reduced rates already
      const { rates } = await vatStateOf(container, regionId)
      if (!rates.some((rate) => rate.active && rate.rate === 10)) {
        await createVatRateWorkflow(container).run({ input: { region_id: regionId, rate: 10 } })
      }
      const sheet = await xlsxOf([
        row({ handle: "kdv-adiyla", title: "Adıyla", vat: "KDV %10", price: 10 }),
        row({ handle: "kdv-oraniyla", title: "Oranıyla", vat: "10", price: 10 }),
        row({ handle: "kdv-varsayilan", title: "Varsayılan", vat: "%20", price: 10 }),
        row({ handle: "kdv-bilinmeyen", title: "Bilinmeyen", vat: "18", price: 10 }),
      ])

      const applied = await upload(sheet, "apply")
      const report = await sheets.fileOf(applied)
      const { data } = await query().graph({
        entity: "product",
        fields: ["handle", "type.value"],
        filters: { handle: ["kdv-adiyla", "kdv-oraniyla", "kdv-varsayilan", "kdv-bilinmeyen"] },
      })
      const types = new Map(
        (data as { handle: string; type: { value: string } | null }[]).map((product) => [
          product.handle,
          product.type?.value ?? null,
        ])
      )

      expect(applied.result_summary).toMatchObject({ create: 3, problems: 1, failed: 0 })
      expect(report.find((cells) => cells[1] === "kdv-bilinmeyen")?.[4]).toMatch(
        /^Bu adla ya da oranla bir KDV oranı yok/
      )
      expect(Object.fromEntries(types)).toEqual({
        "kdv-adiyla": "KDV %10",
        "kdv-oraniyla": "KDV %10",
        // The default taxes products on no VAT type
        "kdv-varsayilan": null,
      })
    })

    it("takes only sheets, through its own route, and keeps the uploads to itself", async () => {
      const refused = await settle(
        http.post<{ message: string }>(
          "/admin/catalog/imports",
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0]),
          {
            headers: { ...admin.headers, "content-type": "application/octet-stream" },
          }
        )
      )
      expect([refused.status, refused.data.message]).toEqual([400, "upload.sheet_invalid"])
      const generic = await settle(
        http.post(
          "/admin/async-jobs",
          { type: "catalog.import", input: { source_file_id: "catalog-import-x", mode: "apply" } },
          { headers: admin.headers }
        )
      )
      expect(generic.status).toBe(400)
      const hidden = await settle(
        http.get("/admin/uploads/catalog-import-x.xlsx", { headers: admin.headers })
      )
      expect(hidden.status).toBe(404)
      const template = await http.get<string>("/admin/catalog/import-template", {
        headers: admin.headers,
        responseType: "text",
      })
      expect(template.status).toBe(200)
    })
  },
})
