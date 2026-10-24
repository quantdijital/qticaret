import { WorkflowResponse, createStep, createWorkflow } from "@medusajs/framework/workflows-sdk"
import { deleteCustomersWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { ProtectedProfileData } from "../../src/modules/billing-profile/service"
import { bootstrapTenant } from "../../src/scripts/bootstrap"
import { createBillingProfileStep } from "../../src/workflows/billing-profile/steps/create-billing-profile"
import { updateBillingProfileStep } from "../../src/workflows/billing-profile/steps/update-billing-profile"
import { upsertCustomerBillingProfileWorkflow } from "../../src/workflows/billing-profile/upsert-customer-billing-profile"
import {
  INDIVIDUAL,
  TCKN,
  billingProfileService,
  saveProfile,
  storedText,
} from "../helpers/billing-profile"
import type { TestCustomer } from "../helpers/customer"
import { registerCustomer } from "../helpers/customer"
import { captureOutput } from "../helpers/logs"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

// Test-only workflows that fail right after a billing profile step, to
// exercise its compensation.
const forcedFailureStep = createStep("test-billing-profile-forced-failure", async () => {
  await Promise.resolve()
  throw new Error("forced failure")
})
const createThenFail = createWorkflow(
  "test-billing-profile-create-then-fail",
  (data: ProtectedProfileData) => {
    createBillingProfileStep(data)
    forcedFailureStep()
    return new WorkflowResponse(undefined)
  }
)
const updateThenFail = createWorkflow(
  "test-billing-profile-update-then-fail",
  (input: { id: string; data: ProtectedProfileData }) => {
    updateBillingProfileStep(input)
    forcedFailureStep()
    return new WorkflowResponse(undefined)
  }
)

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let customer: TestCustomer

    beforeEach(async () => {
      customer = await registerCustomer(http, await createStorefront(getContainer()))
    })

    const save = (body: unknown) => saveProfile(http, customer, body)

    describe("plaintext tax id", () => {
      it("stays out of the database, workflow storage and logs", async () => {
        const output = await captureOutput(async () => {
          await save(INDIVIDUAL)
          await http.get("/store/customers/me/billing-profile", { headers: customer.headers })
        })

        expect(output).not.toContain(TCKN)
        expect(await storedText(getContainer())).not.toContain(TCKN)
      })

      it("stays out of logs and storage when the workflow fails", async () => {
        const container = getContainer()
        const data = billingProfileService(container).prepareProfileData(
          { type: "individual", legal_name: "Ayşe Yılmaz", tax_id: TCKN },
          "cus_missing"
        )

        const output = await captureOutput(async () => {
          const { errors } = await upsertCustomerBillingProfileWorkflow(container).run({
            input: { customer_id: "cus_missing", data },
            throwOnError: false,
          })
          expect(errors.length).toBeGreaterThan(0)
        })

        expect(output).not.toContain(TCKN)
        expect(await storedText(container)).not.toContain(TCKN)
      })

      it("is readable only through the service, for the profile's own customer", async () => {
        const saved = await save(INDIVIDUAL)
        const service = billingProfileService(getContainer())
        const profileId = saved.data.billing_profile?.id ?? ""

        expect(await service.revealTaxId(profileId, customer.id)).toBe(TCKN)
        await expect(service.revealTaxId(profileId, "cus_other")).rejects.toThrow()
      })
    })

    // Medusa's allow lists already drop these; our middleware answers 400
    describe("store fields", () => {
      it.each([
        "/store/customers/me?fields=*billing_profile",
        "/store/customers/me?fields=+billing_profile.tax_id_encrypted,+billing_profile.tax_id_hash",
      ])("%s does not expose the profile", async (url) => {
        const saved = await save(INDIVIDUAL)

        const response = await settle(http.get(url, { headers: customer.headers }))

        expect(response.status).toBe(400)
        expect(JSON.stringify(response.data)).not.toContain(saved.data.billing_profile?.id ?? "-")
        expect(JSON.stringify(response.data)).not.toContain("tax_id")
      })

      it("a cart's customer does not expose the profile", async () => {
        const saved = await save(INDIVIDUAL)
        const { regionId } = await bootstrapTenant(getContainer())
        const { data } = await http.post<{ cart: { id: string } }>(
          "/store/carts",
          { region_id: regionId },
          { headers: customer.headers }
        )

        const response = await settle(
          http.get(`/store/carts/${data.cart.id}?fields=*customer.billing_profile`, {
            headers: customer.headers,
          })
        )

        expect(response.status).toBe(400)
        expect(JSON.stringify(response.data)).not.toContain(saved.data.billing_profile?.id ?? "-")
        expect(JSON.stringify(response.data)).not.toContain("tax_id")
      })
    })

    describe("compensation", () => {
      it("deletes a created profile when a later step fails", async () => {
        const container = getContainer()
        const data = billingProfileService(container).prepareProfileData(
          INDIVIDUAL as never,
          customer.id
        )

        const { errors } = await createThenFail(container).run({ input: data, throwOnError: false })

        expect(errors.length).toBeGreaterThan(0)
        expect(await billingProfileService(container).listBillingProfiles()).toHaveLength(0)
      })

      it("restores the previous ciphertext when a later step fails", async () => {
        const container = getContainer()
        const service = billingProfileService(container)
        const saved = await save(INDIVIDUAL)
        const id = saved.data.billing_profile?.id ?? ""
        const before = await service.retrieveBillingProfile(id)

        const replacement = service.prepareProfileData(
          { type: "corporate", legal_name: "Örnek", tax_office: "Kadıköy", tax_id: "1234567890" },
          customer.id
        )
        const { errors } = await updateThenFail(container).run({
          input: { id, data: replacement },
          throwOnError: false,
        })

        expect(errors.length).toBeGreaterThan(0)
        const after = await service.retrieveBillingProfile(id)
        expect(after).toMatchObject({
          type: before.type,
          tax_id_encrypted: before.tax_id_encrypted,
          tax_id_hash: before.tax_id_hash,
          tax_id_last4: before.tax_id_last4,
        })
        expect(await service.revealTaxId(id, customer.id)).toBe(TCKN)
      })
    })

    describe("customer deletion", () => {
      it("deletes the profile with the customer", async () => {
        await save(INDIVIDUAL)
        const container = getContainer()

        await deleteCustomersWorkflow(container).run({ input: { ids: [customer.id] } })

        expect(await billingProfileService(container).listBillingProfiles()).toHaveLength(0)
      })
    })
  },
})
