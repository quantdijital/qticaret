import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { bootstrapTenant } from "../../src/scripts/bootstrap"
import { createAdminUser } from "../helpers/admin"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront, createTestProduct } from "../helpers/storefront"

jest.setTimeout(180 * 1000)

interface VatRateView {
  id: string
  code: string | null
  name: string
  rate: number
  product_type_id: string | null
  product_type_name: string | null
  products: number
  active: boolean
}

interface VatRates {
  region_id: string
  default: { id: string; code: string | null; name: string; rate: number } | null
  rates: VatRateView[]
  vat_rate?: VatRateView | null
}

interface AuditRow {
  action: string
  resource_id: string | null
  outcome: number
  changes: { diff?: Record<string, { before?: unknown; after?: unknown }> }
}

const summary = (rates: VatRateView[]) =>
  rates.map(({ code, name, rate, product_type_name, products, active }) => ({
    code,
    name,
    rate,
    product_type_name,
    products,
    active,
  }))

/** adr/0007 Ek 2026-11-04: the KDV rates from the panel. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: { headers: Record<string, string> }

    const list = async () =>
      (await http.get<VatRates>("/admin/vat-rates", { headers: owner.headers })).data
    const byCode = async (code: string) => {
      const rate = (await list()).rates.find((candidate) => candidate.code === code)
      if (!rate) {
        throw new Error(`no ${code} rate`)
      }
      return rate
    }
    const audited = (action: string) =>
      eventually(
        async () =>
          (
            await http.get<{ audit_entries: AuditRow[] }>(
              "/admin/audit-log?resource_type=vat_rate&kind=mutation&limit=100",
              { headers: owner.headers }
            )
          ).data.audit_entries.filter((entry) => entry.action === action && entry.outcome === 200),
        (rows) => rows.length > 0
      )
    const post = <T = VatRates>(path: string, body: unknown, headers = owner.headers) =>
      settle(http.post<T>(path, body, { headers }))
    const product = async (container: MedusaContainer, handle: string, typeId?: string) => {
      const storefront = await createStorefront(container)
      return createTestProduct(container, storefront.salesChannelId, {
        handle,
        price: 100,
        ...(typeId ? { typeId } : {}),
      })
    }

    beforeEach(async () => {
      owner = await createAdminUser(http, getContainer())
    })

    it("makes the TR region with the default KDV %20 when a shop has none", async () => {
      const view = await list()

      expect(view.default).toMatchObject({ code: "KDV20", name: "KDV %20", rate: 20 })
      expect(summary(view.rates)).toEqual([
        {
          code: "KDV20",
          name: "KDV %20",
          rate: 20,
          product_type_name: null,
          products: 0,
          active: true,
        },
      ])
      expect((await list()).region_id).toBe(view.region_id)
    })

    it("lists the default and the reduced rates, each with the products taxed at it", async () => {
      const container = getContainer()
      await bootstrapTenant(container)
      const ten = await byCode("KDV10")
      await product(container, "genel-urun")
      await product(container, "indirimli-urun", ten.product_type_id ?? "")

      expect(summary((await list()).rates)).toEqual([
        {
          code: "KDV20",
          name: "KDV %20",
          rate: 20,
          product_type_name: null,
          products: 1,
          active: true,
        },
        {
          code: "KDV10",
          name: "KDV %10",
          rate: 10,
          product_type_name: "KDV %10",
          products: 1,
          active: true,
        },
        {
          code: "KDV1",
          name: "KDV %1",
          rate: 1,
          product_type_name: "KDV %1",
          products: 0,
          active: true,
        },
      ])
    })

    it("adds a rate on a product type of its name, once per percentage, the owner alone", async () => {
      await bootstrapTenant(getContainer())
      const admin = await createAdminUser(http, getContainer(), "admin")

      const added = await post("/admin/vat-rates", { rate: 8.5 })
      const again = await post("/admin/vat-rates", { rate: 10, name: "Yine on" })
      const named = await post("/admin/vat-rates", { rate: 9, name: "kdv %10" })
      const odd = await post("/admin/vat-rates", { rate: 18.125 })
      const byAdmin = await post("/admin/vat-rates", { rate: 5 }, admin.headers)
      const readByAdmin = await settle(http.get("/admin/vat-rates", { headers: admin.headers }))

      expect(added.status).toBe(201)
      expect(added.data.vat_rate).toMatchObject({
        code: "KDV8_5",
        name: "KDV %8,5",
        rate: 8.5,
        product_type_name: "KDV %8,5",
        products: 0,
        active: true,
      })
      expect([again.status, again.data]).toEqual([
        409,
        expect.objectContaining({ message: "vat.rate_exists" }),
      ])
      expect([named.status, named.data]).toEqual([
        409,
        expect.objectContaining({ message: "vat.name_taken" }),
      ])
      expect([odd.status, odd.data]).toEqual([
        400,
        expect.objectContaining({ message: "vat.rate_invalid" }),
      ])
      expect(byAdmin.status).toBe(403)
      expect(readByAdmin.status).toBe(200)
    })

    it("renames a rate and its product type", async () => {
      await bootstrapTenant(getContainer())
      const ten = await byCode("KDV10")

      const renamed = await post(`/admin/vat-rates/${ten.id}`, { name: "İndirimli" })
      const taken = await post(`/admin/vat-rates/${ten.id}`, { name: "KDV %1" })
      const unknown = await post("/admin/vat-rates/txr_01NOPE", { name: "Yok" })

      expect(renamed.status).toBe(200)
      expect(renamed.data.vat_rate).toMatchObject({
        code: "KDV10",
        name: "İndirimli",
        product_type_name: "İndirimli",
      })
      expect([taken.status, taken.data]).toEqual([
        409,
        expect.objectContaining({ message: "vat.name_taken" }),
      ])
      expect(unknown.status).toBe(404)
      const [entry] = await audited("POST /admin/vat-rates/:id")
      expect(entry).toMatchObject({
        resource_id: ten.id,
        changes: { diff: { name: { before: "KDV %10", after: "İndirimli" } } },
      })
    })

    it("removes a rate no product is on, never the default or one in use, and brings it back", async () => {
      const container = getContainer()
      await bootstrapTenant(container)
      const ten = await byCode("KDV10")
      const one = await byCode("KDV1")
      const twenty = await byCode("KDV20")
      await product(container, "indirimli-urun", ten.product_type_id ?? "")

      const inUse = await post(`/admin/vat-rates/${ten.id}`, { active: false })
      const fallback = await post(`/admin/vat-rates/${twenty.id}`, { active: false })
      const removed = await post(`/admin/vat-rates/${one.id}`, { active: false })
      const types = await container.resolve(Modules.PRODUCT).listProductTypes({})
      const addedBack = await post("/admin/vat-rates", { rate: 1, name: "KDV %1 yeni" })
      const clash = await post(`/admin/vat-rates/${one.id}`, { active: true })
      await post(`/admin/vat-rates/${addedBack.data.vat_rate?.id ?? ""}`, { active: false })
      const restored = await post(`/admin/vat-rates/${one.id}`, { active: true })

      expect([inUse.status, inUse.data]).toEqual([
        409,
        expect.objectContaining({ message: "vat.rate_in_use", count: 1 }),
      ])
      expect([fallback.status, fallback.data]).toEqual([
        409,
        expect.objectContaining({ message: "vat.rate_is_default" }),
      ])
      expect(removed.status).toBe(200)
      expect(removed.data.vat_rate).toMatchObject({ code: "KDV1", active: false })
      expect(types.map((type) => type.value)).not.toContain("KDV %1")
      expect(addedBack.data.vat_rate).toMatchObject({ code: "KDV1_2", rate: 1 })
      expect([clash.status, clash.data]).toEqual([
        409,
        expect.objectContaining({ message: "vat.rate_exists" }),
      ])
      expect(restored.status).toBe(200)
      expect(restored.data.vat_rate).toMatchObject({
        code: "KDV1",
        active: true,
        product_type_name: "KDV %1",
      })
    })

    it("bootstrap never makes again a rate the shop removed, nor its product type", async () => {
      const container = getContainer()
      await bootstrapTenant(container)
      const one = await byCode("KDV1")
      await post(`/admin/vat-rates/${one.id}`, { active: false })

      await bootstrapTenant(container)
      const view = await list()
      const types = await container.resolve(Modules.PRODUCT).listProductTypes({})

      expect(view.rates.filter((rate) => rate.active).map((rate) => rate.code)).toEqual([
        "KDV20",
        "KDV10",
      ])
      expect(view.rates.find((rate) => rate.code === "KDV1")?.active).toBe(false)
      expect(types.map((type) => type.value)).toEqual(["KDV %10"])
    })
  },
})
