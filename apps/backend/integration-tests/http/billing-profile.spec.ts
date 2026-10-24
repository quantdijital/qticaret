import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { deleteCustomersWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { BILLING_PROFILE_MODULE } from "../../src/modules/billing-profile"
import type BillingProfileModuleService from "../../src/modules/billing-profile/service"
import { createAdminUser } from "../helpers/admin"
import type { TestCustomer } from "../helpers/customer"
import { registerCustomer } from "../helpers/customer"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import type { Storefront } from "../helpers/storefront"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

// Algorithmically valid test numbers, not real people or companies
const TCKN = "10000000146"
const VKN = "1234567890"

const INDIVIDUAL = { type: "individual", legal_name: "Ayşe Yılmaz", tax_id: TCKN }
const CORPORATE = {
  type: "corporate",
  legal_name: "Örnek Ticaret A.Ş.",
  tax_office: "Kadıköy",
  tax_id: VKN,
}

interface ProfileResponse {
  billing_profile: { id: string; type: string; tax_id_masked: string } | null
}

/** Collects everything written to stdout/stderr while `run` executes. */
async function captureOutput(run: () => Promise<void>): Promise<string> {
  const chunks: string[] = []
  const spies = [process.stdout, process.stderr].map((stream) =>
    jest.spyOn(stream, "write").mockImplementation((chunk: string | Uint8Array) => {
      chunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"))
      return true
    })
  )
  try {
    await run()
  } finally {
    spies.forEach((spy) => {
      spy.mockRestore()
    })
  }
  return chunks.join("")
}

/** Text of every row in tables that could hold the tax id. */
async function storedText(container: MedusaContainer): Promise<string> {
  const db = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const profiles: unknown[] = await db.select("*").from("billing_profile")
  const executions: unknown[] = await db.select("*").from("workflow_execution")
  return JSON.stringify([profiles, executions])
}

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let storefront: Storefront
    let customer: TestCustomer

    beforeEach(async () => {
      storefront = await createStorefront(getContainer())
      customer = await registerCustomer(http, storefront)
    })

    const save = (body: unknown) =>
      settle(
        http.post<ProfileResponse>("/store/customers/me/billing-profile", body, {
          headers: customer.headers,
        })
      )
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
        const service = getContainer().resolve<BillingProfileModuleService>(BILLING_PROFILE_MODULE)
        expect(await service.listBillingProfiles()).toHaveLength(1)
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

    describe("tax id protection", () => {
      it("keeps the plaintext out of the database, workflow storage and logs", async () => {
        const output = await captureOutput(async () => {
          await save(INDIVIDUAL)
          await read()
        })

        expect(output).not.toContain(TCKN)
        expect(await storedText(getContainer())).not.toContain(TCKN)
      })

      it("decrypts only through the service for invoicing (F8)", async () => {
        const saved = await save(INDIVIDUAL)
        const service = getContainer().resolve<BillingProfileModuleService>(BILLING_PROFILE_MODULE)

        expect(await service.revealTaxId(saved.data.billing_profile?.id ?? "")).toBe(TCKN)
      })

      it("shows admins the masked value and keeps it out of customer lists", async () => {
        await save(INDIVIDUAL)
        const admin = await createAdminUser(http, getContainer())

        const detail = await http.get<ProfileResponse>(
          `/admin/customers/${customer.id}/billing-profile`,
          admin
        )
        const list = await http.get("/admin/customers?fields=*billing_profile", admin)

        expect(detail.data.billing_profile?.tax_id_masked).toBe("*******0146")
        expect(JSON.stringify([detail.data, list.data])).not.toContain(TCKN)
      })

      it("deletes the profile with the customer", async () => {
        await save(INDIVIDUAL)
        const container = getContainer()

        await deleteCustomersWorkflow(container).run({ input: { ids: [customer.id] } })

        const service = container.resolve<BillingProfileModuleService>(BILLING_PROFILE_MODULE)
        expect(await service.listBillingProfiles()).toHaveLength(0)
      })
    })
  },
})
