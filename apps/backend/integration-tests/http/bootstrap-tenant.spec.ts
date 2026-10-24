import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateStoresWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { bootstrapTenant } from "../../src/scripts/bootstrap"
import { REDUCED_VAT_RATES } from "../../src/scripts/bootstrap/constants"
import type { HttpClient } from "../helpers/http"
import { createStorefront, createTestProduct } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

interface TaxLine {
  code: string
  rate: number
}

interface CartItem {
  variant_id: string
  is_tax_inclusive: boolean
  total: number
  tax_total: number
  tax_lines: TaxLine[]
}

interface CartResponse {
  cart: { id: string; items: CartItem[] }
}

async function vatProductTypeId(container: MedusaContainer, value: string): Promise<string> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product_type",
    fields: ["id"],
    filters: { value },
  })
  const id = data[0]?.id
  if (!id) {
    throw new Error(`product type ${value} missing`)
  }
  return id
}

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    describe("bootstrapTenant", () => {
      it("running twice leaves one TR region, one tax region and three KDV rates", async () => {
        const container = getContainer()
        const query = container.resolve(ContainerRegistrationKeys.QUERY)

        const first = await bootstrapTenant(container)
        const second = await bootstrapTenant(container)

        expect(second.regionId).toBe(first.regionId)

        const { data: regions } = await query.graph({
          entity: "region",
          fields: ["id", "currency_code", "automatic_taxes", "countries.iso_2"],
        })
        expect(regions).toHaveLength(1)
        expect(regions[0]).toMatchObject({ currency_code: "try", automatic_taxes: true })
        expect(regions[0]?.countries.map((country) => country?.iso_2)).toEqual(["tr"])

        const { data: taxRegions } = await query.graph({
          entity: "tax_region",
          fields: ["id", "tax_rates.code", "tax_rates.rate", "tax_rates.is_default"],
          filters: { country_code: "tr" },
        })
        expect(taxRegions).toHaveLength(1)
        const rates = (taxRegions[0]?.tax_rates ?? [])
          .map((rate) => ({ code: rate?.code, rate: rate?.rate, is_default: rate?.is_default }))
          .sort((a, b) => String(a.code).localeCompare(String(b.code)))
        expect(rates).toEqual([
          { code: "KDV1", rate: 1, is_default: false },
          { code: "KDV10", rate: 10, is_default: false },
          { code: "KDV20", rate: 20, is_default: true },
        ])

        const { data: types } = await query.graph({
          entity: "product_type",
          fields: ["value"],
        })
        expect(types.map((type) => type.value).sort()).toEqual(
          REDUCED_VAT_RATES.map((vat) => vat.productType).sort()
        )
      })

      it("makes TRY the default currency and marks TRY and the region tax inclusive", async () => {
        const container = getContainer()
        const query = container.resolve(ContainerRegistrationKeys.QUERY)
        const { regionId } = await bootstrapTenant(container)

        const { data: stores } = await query.graph({
          entity: "store",
          fields: [
            "default_region_id",
            "supported_currencies.currency_code",
            "supported_currencies.is_default",
          ],
        })
        expect(stores[0]?.default_region_id).toBe(regionId)
        expect(
          stores[0]?.supported_currencies.find((currency) => currency?.is_default)?.currency_code
        ).toBe("try")

        const { data: preferences } = await query.graph({
          entity: "price_preference",
          fields: ["attribute", "value", "is_tax_inclusive"],
        })
        expect(preferences).toEqual(
          expect.arrayContaining([
            { attribute: "currency_code", value: "try", is_tax_inclusive: true },
            { attribute: "region_id", value: regionId, is_tax_inclusive: true },
          ])
        )
      })

      it("cart lines carry tax-inclusive KDV chosen by product type", async () => {
        const container = getContainer()
        const { regionId } = await bootstrapTenant(container)
        const storefront = await createStorefront(container)

        const standardVariant = await createTestProduct(container, storefront.salesChannelId, {
          handle: "standart-urun",
          price: 120,
        })
        const reducedVariant = await createTestProduct(container, storefront.salesChannelId, {
          handle: "indirimli-urun",
          price: 110,
          typeId: await vatProductTypeId(container, "KDV %10"),
        })
        const basicVariant = await createTestProduct(container, storefront.salesChannelId, {
          handle: "temel-gida-urunu",
          price: 101,
          typeId: await vatProductTypeId(container, "KDV %1"),
        })

        const created = await http.post<CartResponse>(
          "/store/carts",
          {
            region_id: regionId,
            shipping_address: { country_code: "tr" },
            items: [
              { variant_id: standardVariant, quantity: 1 },
              { variant_id: reducedVariant, quantity: 1 },
              { variant_id: basicVariant, quantity: 1 },
            ],
          },
          { headers: storefront.headers }
        )
        expect(created.status).toBe(200)

        const { data } = await http.get<CartResponse>(
          `/store/carts/${created.data.cart.id}?fields=*items,*items.tax_lines`,
          { headers: storefront.headers }
        )
        const byVariant = (id: string) => data.cart.items.find((item) => item.variant_id === id)

        expect(byVariant(standardVariant)).toMatchObject({
          is_tax_inclusive: true,
          total: 120,
          tax_total: 20,
          tax_lines: [expect.objectContaining({ code: "KDV20", rate: 20 })],
        })
        expect(byVariant(reducedVariant)).toMatchObject({
          is_tax_inclusive: true,
          total: 110,
          tax_total: 10,
          tax_lines: [expect.objectContaining({ code: "KDV10", rate: 10 })],
        })
        expect(byVariant(basicVariant)).toMatchObject({
          is_tax_inclusive: true,
          total: 101,
          tax_total: 1,
          tax_lines: [expect.objectContaining({ code: "KDV1", rate: 1 })],
        })
      })

      it("keeps the tenant's currency choices and default region on a rerun", async () => {
        const container = getContainer()
        const query = container.resolve(ContainerRegistrationKeys.QUERY)
        await bootstrapTenant(container)
        const { data: before } = await query.graph({ entity: "store", fields: ["id"] })
        const storeId = before[0]?.id ?? ""
        await updateStoresWorkflow(container).run({
          input: {
            selector: { id: storeId },
            update: {
              supported_currencies: [
                { currency_code: "try", is_default: false, is_tax_inclusive: true },
                { currency_code: "eur", is_default: true },
              ],
            },
          },
        })

        await bootstrapTenant(container)

        const { data: after } = await query.graph({
          entity: "store",
          fields: ["supported_currencies.currency_code", "supported_currencies.is_default"],
        })
        const currencies = after[0]?.supported_currencies.map((currency) => ({
          code: currency?.currency_code,
          isDefault: currency?.is_default,
        }))
        expect(currencies).toEqual(
          expect.arrayContaining([
            { code: "eur", isDefault: true },
            { code: "try", isDefault: false },
          ])
        )
      })
    })
  },
})
