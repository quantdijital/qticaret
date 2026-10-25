import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { ProfileResponse } from "../helpers/billing-profile"
import {
  CORPORATE,
  INDIVIDUAL,
  TCKN,
  VKN,
  billingProfileService,
  saveProfile,
} from "../helpers/billing-profile"
import type { TestCustomer } from "../helpers/customer"
import { registerCustomer } from "../helpers/customer"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import type { Storefront } from "../helpers/storefront"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let storefront: Storefront
    let customer: TestCustomer

    beforeEach(async () => {
      storefront = await createStorefront(getContainer())
      customer = await registerCustomer(http, storefront)
    })

    const save = (body: unknown) => saveProfile(http, customer, body)
    const read = () =>
      http.get<ProfileResponse>("/store/customers/me/billing-profile", {
        headers: customer.headers,
      })

    describe("store billing profile", () => {
      it("requires a signed-in customer", async () => {
        const response = await settle(
          http.get("/store/customers/me/billing-profile", { headers: storefront.headers })
        )

        expect(response.status).toBe(401)
      })

      it("returns null before the customer saves a profile", async () => {
        expect((await read()).data).toEqual({ billing_profile: null })
      })

      it("saves an individual profile and only ever returns the masked TCKN", async () => {
        const saved = await save(INDIVIDUAL)
        const fetched = await read()

        expect(saved.status).toBe(200)
        expect(saved.data.billing_profile).toMatchObject({
          type: "individual",
          tax_id_kind: "tckn",
          tax_id_masked: "*******0146",
        })
        expect(fetched.data).toEqual(saved.data)
        expect(JSON.stringify([saved.data, fetched.data])).not.toContain(TCKN)
      })

      it("replaces the profile instead of adding a second one", async () => {
        await save(INDIVIDUAL)
        const replaced = await save(CORPORATE)

        expect(replaced.data.billing_profile).toMatchObject({
          type: "corporate",
          tax_office: "Kadıköy",
          tax_id_masked: "******7890",
        })
        expect(await billingProfileService(getContainer()).listBillingProfiles()).toHaveLength(1)
      })

      it("keeps one profile when two first saves race", async () => {
        const responses = await Promise.all([save(INDIVIDUAL), save(CORPORATE)])

        expect(responses.map((response) => response.status)).toEqual([200, 200])
        expect(await billingProfileService(getContainer()).listBillingProfiles()).toHaveLength(1)
      })

      it.each([
        ["an invalid TCKN", { ...INDIVIDUAL, tax_id: "10000000147" }],
        ["a VKN for an individual", { ...INDIVIDUAL, tax_id: VKN }],
        ["a corporate without tax office", { ...CORPORATE, tax_office: undefined }],
      ])("rejects %s with 400 without echoing the number", async (_case, body) => {
        const response = await save(body)

        expect(response.status).toBe(400)
        expect(JSON.stringify(response.data)).not.toContain(body.tax_id)
      })
    })

    describe("admin billing profile", () => {
      it("shows the masked value and keeps the tax id out of customer lists", async () => {
        await save(INDIVIDUAL)
        const admin = await createAdminUser(http, getContainer())

        const detail = await http.get<ProfileResponse>(
          `/admin/customers/${customer.id}/billing-profile`,
          admin
        )
        // The link would return the encrypted tax id and its hash for every customer
        const list = await settle(http.get("/admin/customers?fields=*billing_profile", admin))

        expect(detail.data.billing_profile?.tax_id_masked).toBe("*******0146")
        expect(list.status).toBe(400)
        expect(JSON.stringify([detail.data, list.data])).not.toContain(TCKN)
      })
    })
  },
})
