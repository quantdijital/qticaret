import { randomUUID } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { createUserAccountWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"

jest.setTimeout(120 * 1000)

interface Answer {
  status: number
  data: unknown
  headers: Record<string, string | undefined>
}

// test-utils types `api` as any (axios); answers of any status are read, not thrown
interface HttpClient {
  get(url: string, config?: object): Promise<Answer>
  post(url: string, body: unknown, config?: object): Promise<Answer>
}

const anyStatus = { validateStatus: () => true }

const tokenOf = (answer: Answer): string => (answer.data as { token: string }).token

/** A staff member signed in through the allowed auth routes: bearer headers. */
async function signInStaff(http: HttpClient, container: MedusaContainer) {
  const email = `staff-${randomUUID()}@quant.test`
  // Throwaway credential for this test database only
  const password = randomUUID()
  // A login is made on the server: the API makes one only with an invitation (Ek C4, L1)
  const made = await container
    .resolve(Modules.AUTH)
    .register("emailpass", { body: { email, password } })
  const authIdentityId = made.authIdentity?.id ?? ""
  await createUserAccountWorkflow(container).run({ input: { authIdentityId, userData: { email } } })
  const login = await http.post("/auth/user/emailpass", { email, password })
  return { authorization: `Bearer ${tokenOf(login)}` }
}

const CORE_ADMIN = ["/admin/products", "/ADMIN/Products/", "/admin/users", "/admin/api-keys"]
const CORE_STORE = ["/store/products", "/store/regions", "/store/carts"]

// The allowlist's answer, not a core handler's own 404
const REFUSED = {
  type: "not_found",
  message: "errors.not_found",
  request_id: expect.any(String) as unknown,
}

/**
 * adr/0061 §1.1 (C3): the control plane answers only its own routes.
 * Medusa's own namespace guards run before any app middleware (adr/0061
 * Ek, C3): an /admin call without a session gets their 401 and a /store
 * call without a publishable key their 400, neither reaching a handler.
 * Past them, every core route is a 404.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    describe("GET /health", () => {
      it("answers 200 and says nothing about the instance", async () => {
        const response = await http.get("/health", anyStatus)

        expect(response.status).toBe(200)
        expect(JSON.stringify(response.data).length).toBeLessThan(20)
      })
    })

    describe("core admin routes", () => {
      it.each(CORE_ADMIN)("GET %s answers 404 to signed-in staff", async (path) => {
        const headers = await signInStaff(http, getContainer())
        const response = await http.get(path, { ...anyStatus, headers })

        expect(response.status).toBe(404)
        expect(response.data).toMatchObject(REFUSED)
        expect(response.headers["x-content-type-options"]).toBe("nosniff")
        expect(response.headers["x-request-id"]).toBeDefined()
      })

      it("POST /admin/products answers 404 to signed-in staff, nothing created", async () => {
        const headers = await signInStaff(http, getContainer())
        const response = await http.post(
          "/admin/products",
          { title: "Bıçak", options: [{ title: "Boy", values: ["20 cm"] }] },
          { ...anyStatus, headers }
        )

        expect(response.status).toBe(404)
        expect(response.data).toMatchObject(REFUSED)
      })

      it.each(CORE_ADMIN)("GET %s without a session gets Medusa's 401, no data", async (path) => {
        const response = await http.get(path, anyStatus)

        expect(response.status).toBe(401)
        expect(JSON.stringify(response.data)).not.toContain("products")
      })
    })

    describe("core store routes", () => {
      it.each(CORE_STORE)("GET %s answers 404 even with a publishable key", async (path) => {
        const [key] = await getContainer()
          .resolve(Modules.API_KEY)
          .createApiKeys([{ title: "test", type: "publishable", created_by: "test" }])
        const headers = { "x-publishable-api-key": key?.token ?? "" }
        const response = await http.get(path, { ...anyStatus, headers })

        expect(response.status).toBe(404)
        expect(response.data).toMatchObject(REFUSED)
      })

      it("POST /store/carts without a key gets Medusa's 400", async () => {
        const response = await http.post("/store/carts", {}, anyStatus)

        expect(response.status).toBe(400)
      })
    })

    describe("everything else outside the allowlist", () => {
      it.each(["/", "/app", "/hooks/paytr", "/static/x.png", "/healthz"])(
        "GET %s answers 404 with the security headers",
        async (path) => {
          const response = await http.get(path, anyStatus)

          expect(response.status).toBe(404)
          expect(response.data).toMatchObject(REFUSED)
          expect(response.headers["x-frame-options"]).toBe("DENY")
        }
      )

      it.each(["/auth/customer/emailpass/register", "/auth/customer/emailpass"])(
        "POST %s answers 404: there are no customers here",
        async (path) => {
          const response = await http.post(
            path,
            { email: "a@quant.test", password: "irrelevant" },
            anyStatus
          )

          expect(response.status).toBe(404)
          expect(response.data).toMatchObject(REFUSED)
        }
      )

      it("refuses a dot segment that would step out of an allowed prefix", async () => {
        const response = await http.get("/tenant-api/%2e%2e/store/products", anyStatus)

        expect(response.status).toBe(400)
      })
    })

    describe("routes inside the allowlist", () => {
      it("leaves the control plane's admin API to Medusa's authentication", async () => {
        const response = await http.get("/admin/cp/anything", anyStatus)

        expect(response.status).toBe(401)
      })

      it("lets staff sign in", async () => {
        const headers = await signInStaff(http, getContainer())

        expect(headers.authorization).toMatch(/^Bearer /)
      })

      it("refuses a wrong password at Medusa's auth route", async () => {
        const response = await http.post(
          "/auth/user/emailpass",
          { email: "nobody@quant.test", password: "wrong-password" },
          anyStatus
        )

        expect(response.status).toBe(401)
      })
    })
  },
})
