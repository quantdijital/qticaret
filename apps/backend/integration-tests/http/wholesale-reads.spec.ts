import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import { registerCustomer } from "../helpers/customer"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { joinGroup, tierRecords, wholesaleApi } from "../helpers/wholesale"

jest.setTimeout(240 * 1000)

/**
 * ADR-0068 security review: wholesale prices and members stay with the
 * owner and admin (decision 17, M1), no price rule names a wholesale group
 * round the module (M2), the Store API shows no price row (M3), and the
 * sync job is the managers' to see (L4). A level member's product sells
 * at 93.32 (77.77 net), a number found nowhere else.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let staff: ReturnType<typeof wholesaleApi>
    let shop: StockShop
    let store: Storefront

    beforeEach(async () => {
      const admin = await createAdminUser(http, getContainer())
      staff = wholesaleApi(http, admin.headers)
      shop = await stockShop(getContainer())
      store = await createStorefront(getContainer())
      await staff.flag(true)
    })

    async function wholesaleProduct(handle: string) {
      const product = await stockedProduct(getContainer(), shop, handle, null, 100)
      const tier = await staff.tier({ name: `Toptan ${handle}` })
      await staff.prices(tier.id, { set: [{ variant_id: product.variantId, net: "77.77" }] })
      const records = await tierRecords(getContainer(), tier.id)
      const [row] = await getContainer()
        .resolve(Modules.PRICING)
        .listPrices({ price_list_id: [records.priceListId] }, { select: ["id"], take: 1 })
      return { ...product, ...records, tier, rowId: row?.id ?? "" }
    }

    const as = async (role: "operations" | "readonly" | "admin") =>
      wholesaleApi(http, (await createAdminUser(http, getContainer(), role)).headers)

    it("keeps wholesale price rows out of every product read, however expanded (M1)", async () => {
      const { productId, rowId } = await wholesaleProduct("urun-okuma")
      expect(rowId).not.toBe("")
      for (const reader of [staff, await as("operations"), await as("readonly")]) {
        for (const fields of [
          "*variants.prices",
          "variants.prices.id,variants.prices.amount",
          "*variants.price_set.prices",
          "+variants.price_set.prices.id",
        ]) {
          const answer = await reader.get(`/admin/products/${productId}?fields=${fields}`)
          const text = JSON.stringify(answer.data)
          expect({ fields, status: answer.status, row: text.includes(rowId) }).toMatchObject({
            fields,
            row: false,
          })
          expect(text).not.toContain("93.32")
        }
      }
    })

    it("keeps who is in a wholesale group to the owner and admin (M1)", async () => {
      const { groupId } = await wholesaleProduct("uye-okuma")
      const customer = await registerCustomer(http, store)
      await joinGroup(getContainer(), groupId, customer.id)
      const groupsOf = async (reader: typeof staff) =>
        (
          await reader.get<{ customer: { groups: { id: string }[] } }>(
            `/admin/customers/${customer.id}?fields=id,*groups`
          )
        ).data.customer.groups.map((group) => group.id)

      for (const reader of [await as("operations"), await as("readonly")]) {
        const byGroup = await reader.get(`/admin/customers?groups=${groupId}`)
        expect([byGroup.status, (byGroup.data as { message?: string }).message]).toEqual([
          400,
          "wholesale.managed",
        ])
        expect(await groupsOf(reader)).not.toContain(groupId)
      }
      for (const reader of [staff, await as("admin")]) {
        expect(await groupsOf(reader)).toContain(groupId)
        expect((await reader.get(`/admin/customers?groups=${groupId}`)).status).toBe(200)
      }
    })

    it("refuses a price whose own rule names a wholesale group, on a list or a variant (M2)", async () => {
      const { productId, variantId, groupId } = await wholesaleProduct("kural")
      const rules = { "customer.groups.id": groupId }
      const price = { variant_id: variantId, currency_code: "try", amount: 1, rules }
      const sale = await staff.post<{ price_list: { id: string } }>("/admin/price-lists", {
        title: "Herkese",
        description: "",
        status: "active",
        type: "sale",
      })
      const attempts = [
        await staff.post("/admin/price-lists", {
          title: "Kurallı satır",
          description: "",
          status: "active",
          type: "override",
          prices: [price],
        }),
        await staff.post(`/admin/price-lists/${sale.data.price_list.id}/prices/batch`, {
          create: [price],
        }),
        await staff.post(`/admin/products/${productId}/variants/${variantId}`, {
          prices: [
            { currency_code: "try", amount: 100 },
            { currency_code: "try", amount: 1, rules },
          ],
        }),
        await staff.post(`/admin/products/${productId}/variants/batch`, {
          update: [{ id: variantId, prices: [{ currency_code: "try", amount: 1, rules }] }],
        }),
      ]
      // 409 from the guard; 400 where Medusa's own schema takes no `rules` there
      expect(attempts.map((answer) => [400, 409].includes(answer.status))).toEqual(
        attempts.map(() => true)
      )
      // Whichever answered, no price with that rule was written
      const written = await getContainer()
        .resolve(Modules.PRICING)
        .listPriceRules({}, { select: ["id", "value"], take: null })
      expect(written.filter((rule) => rule.value === groupId)).toEqual([])
    })

    it("shows no price row on the Store API to a guest or a shopper not in the group (M3)", async () => {
      const { productId } = await wholesaleProduct("vitrin")
      const shopper = await registerCustomer(http, store)
      for (const headers of [store.headers, shopper.headers]) {
        for (const fields of [
          "*variants.prices",
          "+variants.prices.amount",
          "*variants.price_set",
          "+variants.price_set.prices",
        ]) {
          const answer = await settle(
            http.get(`/store/products/${productId}?region_id=${shop.regionId}&fields=${fields}`, {
              headers,
            })
          )
          expect({ fields, status: answer.status }).toEqual({ fields, status: 400 })
        }
        const plain = await settle(
          http.get(`/store/products/${productId}?region_id=${shop.regionId}`, { headers })
        )
        expect(plain.status).toBe(200)
        expect(JSON.stringify(plain.data)).not.toContain("93.32")
      }
    })

    it("shows the sync job to the owner and admin only (L4)", async () => {
      await staff.tier({ name: "Toptan İş", percent: 10 })
      const jobsOf = async (reader: typeof staff) =>
        (
          await reader.get<{ async_jobs: { type: string }[] }>("/admin/async-jobs")
        ).data.async_jobs.map((job) => job.type)
      expect(
        await eventually(
          () => jobsOf(staff),
          (types) => types.includes("wholesale.sync")
        )
      ).toContain("wholesale.sync")
      expect(await jobsOf(await as("admin"))).toContain("wholesale.sync")
      expect(await jobsOf(await as("operations"))).not.toContain("wholesale.sync")
    })
  },
})
