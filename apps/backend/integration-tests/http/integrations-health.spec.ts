import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(60 * 1000)

interface HealthBody {
  status: string
  checked_at: string
  checks: { id: string; kind: string; status: string; latency_ms: number; reason?: string }[]
}

/** F2.6: GET /admin/integrations/health. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("requires an admin user", async () => {
      const response = await settle(http.get("/admin/integrations/health"))

      expect(response.status).toBe(401)
    })

    it("reports each dependency with a status and no connection details", async () => {
      const admin = await createAdminUser(http, getContainer())

      const response = await http.get<HealthBody>("/admin/integrations/health", {
        headers: admin.headers,
      })

      expect(response.status).toBe(200)
      expect(["ok", "degraded"]).toContain(response.data.status)
      // The shop's providers; no account stored is not a failure
      expect(response.data.checks).toContainEqual(
        expect.objectContaining({ id: "paytr", kind: "payment", status: "not_configured" })
      )
      // The platform's own services are operations' to watch, not the shop's
      expect(response.data.checks.map((check) => check.id)).not.toContain("redis")
      expect(JSON.stringify(response.data)).not.toMatch(/redis:\/\/|password|@/)
    })
  },
})
