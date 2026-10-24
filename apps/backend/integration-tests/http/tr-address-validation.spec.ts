import {
  createCartWorkflow,
  createCustomerAddressesWorkflow,
  updateCartWorkflow,
} from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { bootstrapTenant } from "../../src/scripts/bootstrap"
import type { TestCustomer } from "../helpers/customer"
import { registerCustomer } from "../helpers/customer"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import type { Storefront } from "../helpers/storefront"
import { createStorefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

// jest's asymmetric matchers are typed any
const anyString: unknown = expect.any(String)
const containing = (text: string): unknown => expect.stringContaining(text)

interface IssueResponse {
  type: string
  issues: { field: string; code: string }[]
}

interface CustomerResponse {
  customer: { addresses: { id: string; city: string; phone: string | null }[] }
}

const VALID_ADDRESS = {
  first_name: "Ayşe",
  last_name: "Yılmaz",
  address_1: "Moda Caddesi No: 1 Daire: 2",
  address_2: "Caferağa",
  city: "Kadıköy",
  province: "İstanbul",
  postal_code: "34710",
  country_code: "tr",
  phone: "0532 123 45 67",
}

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let storefront: Storefront
    let customer: TestCustomer
    let regionId: string

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      regionId = (await bootstrapTenant(container)).regionId
      storefront = await createStorefront(container)
      customer = await registerCustomer(http, storefront)
    })

    const post = <T>(url: string, body: unknown, headers = customer.headers) =>
      settle(http.post<T>(url, body, { headers }))

    describe("customer addresses", () => {
      it("returns 400 for a district outside the province", async () => {
        const response = await post<IssueResponse>("/store/customers/me/addresses", {
          ...VALID_ADDRESS,
          province: "Ankara",
          address_2: "",
          postal_code: "",
        })

        expect(response.status).toBe(400)
        expect(response.data).toEqual({
          type: "invalid_data",
          message: anyString,
          issues: [{ field: "city", code: "tr_address.district_not_in_province" }],
        })
      })

      it("returns 400 for an unknown province", async () => {
        const response = await post<IssueResponse>("/store/customers/me/addresses", {
          ...VALID_ADDRESS,
          province: "Atlantis",
        })

        expect(response.status).toBe(400)
        expect(response.data.issues).toContainEqual({
          field: "province",
          code: "tr_address.province_not_found",
        })
      })

      it("saves a valid address with the phone in E.164", async () => {
        const response = await post<CustomerResponse>(
          "/store/customers/me/addresses",
          VALID_ADDRESS
        )

        expect(response.status).toBe(200)
        expect(response.data.customer.addresses[0]).toMatchObject({
          city: "Kadıköy",
          phone: "+905321234567",
        })
      })

      it("checks a partial update against the stored address", async () => {
        const created = await post<CustomerResponse>("/store/customers/me/addresses", VALID_ADDRESS)
        const addressId = created.data.customer.addresses[0]?.id ?? ""

        const response = await post<IssueResponse>(`/store/customers/me/addresses/${addressId}`, {
          city: "Çankaya",
        })

        expect(response.status).toBe(400)
        expect(response.data.issues).toContainEqual({
          field: "city",
          code: "tr_address.district_not_in_province",
        })
      })

      it("accepts names typed without Turkish letters", async () => {
        const response = await post<CustomerResponse>("/store/customers/me/addresses", {
          ...VALID_ADDRESS,
          province: "Istanbul",
          city: "KADIKOY",
          address_2: "Caferaga Mah.",
        })

        expect(response.status).toBe(200)
      })

      it("leaves non-Turkish addresses alone", async () => {
        const response = await post("/store/customers/me/addresses", {
          ...VALID_ADDRESS,
          country_code: "de",
          province: "Berlin",
          city: "Berlin",
          postal_code: "10115",
          phone: "+49 30 123456",
        })

        expect(response.status).toBe(200)
      })
    })

    describe("cart addresses", () => {
      it("returns 400 for a postal code from another province", async () => {
        const response = await post<IssueResponse>(
          "/store/carts",
          { region_id: regionId, shipping_address: { ...VALID_ADDRESS, postal_code: "06420" } },
          storefront.headers
        )

        expect(response.status).toBe(400)
        expect(response.data.issues).toEqual([
          {
            field: "shipping_address.postal_code",
            code: "tr_address.postal_code_province_mismatch",
          },
        ])
      })

      it("returns 400 when an update makes the billing address inconsistent", async () => {
        const created = await post<{ cart: { id: string } }>(
          "/store/carts",
          { region_id: regionId, billing_address: VALID_ADDRESS },
          storefront.headers
        )
        expect(created.status).toBe(200)

        const response = await post<IssueResponse>(
          `/store/carts/${created.data.cart.id}`,
          { billing_address: { address_2: "Kızılay" } },
          storefront.headers
        )

        expect(response.status).toBe(400)
        expect(response.data.issues).toEqual([
          { field: "billing_address.address_2", code: "tr_address.neighborhood_not_in_district" },
        ])
      })
    })

    describe("cart address updates", () => {
      it("accepts a valid update and stores the phone in E.164", async () => {
        const created = await post<{ cart: { id: string } }>(
          "/store/carts",
          { region_id: regionId },
          storefront.headers
        )

        const response = await post<{ cart: { shipping_address: { phone: string } } }>(
          `/store/carts/${created.data.cart.id}`,
          { shipping_address: VALID_ADDRESS },
          storefront.headers
        )

        expect(response.status).toBe(200)
        expect(response.data.cart.shipping_address.phone).toBe("+905321234567")
      })
    })

    describe("cart workflow hooks", () => {
      // Workflow errors reach the caller serialized, not as Error instances
      it("reject an invalid address even when the Store API is bypassed", async () => {
        const container = getContainer()

        await expect(
          createCartWorkflow(container).run({
            input: { region_id: regionId, shipping_address: { ...VALID_ADDRESS, city: "Çankaya" } },
          })
        ).rejects.toMatchObject({ message: containing("tr_address.district_not_in_province") })

        const { result: cart } = await createCartWorkflow(container).run({
          input: { region_id: regionId, shipping_address: VALID_ADDRESS },
        })
        await expect(
          updateCartWorkflow(container).run({
            input: { id: cart.id, shipping_address: { postal_code: "99999" } },
          })
        ).rejects.toMatchObject({ message: containing("tr_address.postal_code_invalid") })
      })

      it("reject an invalid customer address saved outside the Store API, e.g. by an admin", async () => {
        const container = getContainer()

        await expect(
          createCustomerAddressesWorkflow(container).run({
            input: {
              addresses: [{ ...VALID_ADDRESS, customer_id: customer.id, province: "Ankara" }],
            },
          })
        ).rejects.toMatchObject({ message: containing("tr_address.district_not_in_province") })

        const { data } = await http.get<CustomerResponse>("/store/customers/me", {
          headers: customer.headers,
        })
        expect(data.customer.addresses).toHaveLength(0)
      })
    })
  },
})
