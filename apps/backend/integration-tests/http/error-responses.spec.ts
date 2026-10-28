import { randomUUID } from "node:crypto"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { classifyDbMessage } from "../../src/api/http/error-response"
import { MedusaPinoLogger, currentRequestId, logger } from "../../src/lib/logging"
import { createAdminUser } from "../helpers/admin"
import { registerCustomer } from "../helpers/customer"
import type { HttpClient, HttpResponse } from "../helpers/http"
import { settle } from "../helpers/http"
import { captureOutput } from "../helpers/logs"
import type { Storefront } from "../helpers/storefront"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

interface ErrorBody {
  type?: string
  message?: string
  request_id?: string
}

const requestIdOf = (response: HttpResponse<unknown>): unknown => response.headers["x-request-id"]

/**
 * F2.10 (docs/04): error bodies carry no database values outside the admin
 * API, every response names its request ID, and logs carry it too.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let storefront: Storefront

    beforeEach(async () => {
      storefront = await createStorefront(getContainer())
    })

    // Core store routes check for duplicates before writing (no store route
    // reaches a unique violation without a race), so the store case is
    // Medusa's own fixed text; the admin case is a real database error and
    // pins the template `classifyDbMessage` relies on. The path rule itself
    // is unit-tested (src/api/http/__tests__/error-handler.unit.spec.ts).
    describe("duplicates", () => {
      it("refuses a taken e-mail on the store API without the value", async () => {
        const email = `customer-${randomUUID()}@example.com`
        const registration = await http.post<{ token: string }>(
          "/auth/customer/emailpass/register",
          { email, password: randomUUID() }
        )
        // The account is opened for the identity's own address whatever the
        // body says (adr/0037), so the address is taken by opening it twice
        const open = () =>
          settle(
            http.post<ErrorBody>(
              "/store/customers",
              { email },
              {
                headers: {
                  ...storefront.headers,
                  authorization: `Bearer ${registration.data.token}`,
                },
              }
            )
          )
        const first = await open()
        const response = await open()

        expect(first.status).toBe(200)
        expect(response.status).toBe(422)
        expect(response.data).toMatchObject({
          type: "duplicate_error",
          request_id: requestIdOf(response),
        })
        expect(JSON.stringify(response.data)).not.toContain(email)
      })

      it("keeps Medusa's database message on the admin API", async () => {
        const admin = await createAdminUser(http, getContainer())
        const email = `admin-created-${randomUUID()}@example.com`
        await http.post("/admin/customers", { email }, { headers: admin.headers })

        const response = await settle(
          http.post<ErrorBody>("/admin/customers", { email }, { headers: admin.headers })
        )

        expect(response.status).toBe(400)
        expect(response.data.message).toContain(email)
        // Outside /admin this exact text would be replaced
        expect(classifyDbMessage(response.data.message ?? "")).toBe("duplicate")
        expect(response.data.request_id).toBe(requestIdOf(response))
      })
    })

    // Medusa's dbErrorMapper is not exported; these produce its real texts
    // through a module service so a template change breaks here
    describe("database error templates", () => {
      const rejectionOf = async (run: () => Promise<unknown>): Promise<string> => {
        try {
          await run()
        } catch (error) {
          return (error as Error).message
        }
        throw new Error("expected the call to fail")
      }

      it("recognises Medusa's unique and foreign key texts", async () => {
        const customers = getContainer().resolve(Modules.CUSTOMER)
        const email = `template-${randomUUID()}@example.com`
        await customers.createCustomers([{ email }])

        const duplicate = await rejectionOf(() => customers.createCustomers([{ email }]))
        const missingParent = await rejectionOf(() =>
          customers.createCustomerAddresses([{ customer_id: "cus_missing", address_1: "x" }])
        )

        expect(classifyDbMessage(duplicate)).toBe("duplicate")
        expect(classifyDbMessage(missingParent)).toBe("invalid_reference")
      })
    })

    describe("malformed bodies", () => {
      it("answer 400 without echoing or logging the body", async () => {
        const password = `pw-${randomUUID()}`
        let response: HttpResponse<ErrorBody> | undefined

        const output = await captureOutput(async () => {
          response = await settle(
            http.post<ErrorBody>(
              "/auth/customer/emailpass",
              `{"email":"ayse@example.com","password":"${password}",}`,
              { headers: { "content-type": "application/json" } }
            )
          )
        })

        expect(response?.status).toBe(400)
        expect(response?.data).toEqual({
          type: "invalid_data",
          message: "errors.invalid_data",
          request_id: response ? requestIdOf(response) : undefined,
        })
        expect(output).toContain("http_entity.parse.failed")
        expect(output).not.toContain(password)
      })
    })

    describe("logger", () => {
      it("is the platform logger in Medusa's container", () => {
        const logger: unknown = getContainer().resolve(ContainerRegistrationKeys.LOGGER)

        expect(logger).toBeInstanceOf(MedusaPinoLogger)
      })
    })

    describe("request ID", () => {
      it("echoes a valid incoming ID", async () => {
        const response = await http.get("/store/regions", {
          headers: { ...storefront.headers, "x-request-id": "edge-12345678" },
        })

        expect(requestIdOf(response)).toBe("edge-12345678")
      })

      it("replaces an ID that is not in the accepted format", async () => {
        const response = await http.get("/store/regions", {
          headers: { ...storefront.headers, "x-request-id": "forged id; level=error" },
        })

        expect(requestIdOf(response)).toEqual(expect.stringMatching(UUID))
      })

      it("issues one when none is sent", async () => {
        const response = await http.get("/store/regions", { headers: storefront.headers })

        expect(requestIdOf(response)).toEqual(expect.stringMatching(UUID))
      })
    })

    describe("logs", () => {
      it("write a JSON line with the request ID and no credentials", async () => {
        const customer = await registerCustomer(http, storefront)
        const wrongPassword = `wrong-${randomUUID()}`
        const bearer = `bearer-${randomUUID()}`
        let response: HttpResponse<ErrorBody> | undefined

        const output = await captureOutput(async () => {
          response = await settle(
            http.post<ErrorBody>(
              "/auth/customer/emailpass",
              { email: customer.email, password: wrongPassword },
              { headers: { authorization: `Bearer ${bearer}` } }
            )
          )
        })

        expect(response?.status).toBe(401)
        const lines = output
          .split("\n")
          .filter((line) => line.startsWith("{"))
          .map((line) => JSON.parse(line) as Record<string, unknown>)
        expect(lines).toContainEqual(
          expect.objectContaining({
            event: "http.request_rejected",
            status: 401,
            request_id: response?.data.request_id,
          })
        )
        expect(output).not.toContain(wrongPassword)
        expect(output).not.toContain(bearer)
        expect(output).not.toContain(customer.email)
      })

      it("run inside the request's log context in the route handler", async () => {
        const write = logger.info
        const contexts: (string | undefined)[] = []
        // Records the context at the moment the handler logs; the handler
        // writes request_id itself only when that context is missing
        const spy = jest.spyOn(logger, "info").mockImplementation((fields, message) => {
          contexts.push(currentRequestId())
          write(fields, message)
        })
        try {
          const response = await settle(
            http.post<ErrorBody>("/auth/customer/emailpass", {
              email: `nobody-${randomUUID()}@example.com`,
              password: randomUUID(),
            })
          )

          expect(response.status).toBe(401)
          expect(contexts).toContain(response.data.request_id)
        } finally {
          spy.mockRestore()
        }
      })
    })
  },
})
