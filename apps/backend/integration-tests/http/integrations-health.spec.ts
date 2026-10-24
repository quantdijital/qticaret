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
      expect(response.data.checks).toContainEqual(
        expect.objectContaining({
          id: "redis",
          kind: "cache",
          status: expect.stringMatching(/^(ok|down|not_configured)$/) as string,
        })
      )
      expect(JSON.stringify(response.data)).not.toMatch(/redis:\/\/|password|@/)
    })
  },
})
