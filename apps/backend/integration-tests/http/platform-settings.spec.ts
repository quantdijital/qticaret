import type { MedusaRequest } from "@medusajs/framework/http"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { createApiKeysWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakeResponse } from "../../src/api/http/__tests__/fakes"
import { requireFeature } from "../../src/api/http/require-feature"
import { assertFeatureEnabledStep } from "../../src/workflows/platform-settings/steps/assert-feature-enabled"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(120 * 1000)

// A flow behind the test flag: the step after the gate records that it ran
const ran: string[] = []
const markerStep = createStep("test-feature-marker", (input: string) => {
  ran.push(input)
  return new StepResponse(input)
})
const gatedWorkflow = createWorkflow("test-feature-gated-flow", (input: { run: string }) => {
  assertFeatureEnabledStep("test.sample")
  return new WorkflowResponse(markerStep(input.run))
})

interface AuditEntry {
  action: string
  resource_id: string | null
  changes: { diff?: Record<string, unknown> } | null
}

/** F2.3 (adr/0012): settings sections and feature flags; KK: a disabled flag keeps its route and flow off. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }

    const setFlag = (key: string, enabled: boolean) =>
      settle(http.post(`/admin/features/${key}`, { enabled }, { headers: admin.headers }))

    async function gate(): Promise<{ status: number; body: unknown; passed: boolean }> {
      const req = {
        method: "GET",
        originalUrl: "/admin/no-such-route-anywhere",
        requestId: "req-12345678",
        scope: getContainer(),
      } as unknown as MedusaRequest
      const response = fakeResponse()
      const next = jest.fn()
      await requireFeature("test.sample")(req, response.res, next)
      return {
        status: response.status(),
        body: response.body(),
        passed: next.mock.calls.length > 0,
      }
    }

    // Entries land once the response has finished; `until` says which one is awaited
    async function auditEntries(
      resourceId: string,
      until: (entries: AuditEntry[]) => boolean = (entries) => entries.length > 0
    ): Promise<AuditEntry[]> {
      for (let attempt = 0; attempt < 30; attempt++) {
        const { data } = await http.get<{ audit_entries: AuditEntry[] }>(
          `/admin/audit-log?resource_id=${resourceId}&kind=mutation`,
          { headers: admin.headers }
        )
        if (until(data.audit_entries)) {
          return data.audit_entries
        }
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      return []
    }

    beforeEach(async () => {
      ran.length = 0
      admin = await createAdminUser(http, getContainer())
      // The database is emptied between tests but this process's settings
      // cache is not; a write through the API brings it back in line
      await setFlag("test.sample", false)
    })

    it("keeps a route and a flow off while their flag is off (F2 KK)", async () => {
      const off = await gate()
      const blocked = await gatedWorkflow(getContainer())
        .run({ input: { run: "off" } })
        .then(
          () => null,
          (error: unknown) => error
        )

      expect(off).toMatchObject({ status: 404, passed: false })
      expect((blocked as Error | null)?.message).toBe("features.disabled")
      expect(ran).toEqual([])

      expect((await setFlag("test.sample", true)).status).toBe(200)
      const on = await gate()
      await gatedWorkflow(getContainer()).run({ input: { run: "on" } })

      expect(on.passed).toBe(true)
      expect(ran).toEqual(["on"])
    })

    it("answers a disabled route like a route that does not exist", async () => {
      const missing = await settle(
        http.get("/admin/no-such-route-anywhere", { headers: admin.headers })
      )
      const off = await gate()

      expect(off.status).toBe(missing.status)
      expect(off.body).toBe(missing.data)
    })

    it("lists flags with owners and records a change with its value before and after", async () => {
      const { data } = await http.get<{ features: { key: string; owner: string }[] }>(
        "/admin/features",
        { headers: admin.headers }
      )
      await setFlag("test.sample", true)
      // The reset before each test is recorded too: wait for this change's own entry
      const turnedOn = (each: AuditEntry) =>
        JSON.stringify(each.changes?.diff ?? {}).includes('"after":true')
      const entry = (await auditEntries("test.sample", (entries) => entries.some(turnedOn))).find(
        turnedOn
      )

      expect(data.features).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: "test.sample", owner: "tenant" }),
          expect.objectContaining({ key: "test.platform_sample", owner: "platform" }),
        ])
      )
      expect(entry).toMatchObject({
        action: "POST /admin/features/:key",
        changes: { diff: { enabled: { before: false, after: true } } },
      })
    })

    it("refuses platform flags, unknown flags and bodies that are not a boolean", async () => {
      expect((await setFlag("test.platform_sample", false)).status).toBe(403)
      expect((await setFlag("no.such_flag", true)).status).toBe(404)
      const notBoolean = await settle(
        http.post("/admin/features/test.sample", { enabled: "yes" }, { headers: admin.headers })
      )
      expect(notBoolean.status).toBe(400)
    })

    it("saves part of a section over its values and records each field that changed", async () => {
      const before = await http.get<{ version: number; values: Record<string, unknown> }>(
        "/admin/platform-settings/seo",
        { headers: admin.headers }
      )
      const saved = await http.post<{ version: number; values: { title_templates: object } }>(
        "/admin/platform-settings/seo",
        { title_templates: { brand: "{marka} Bıçakları | {mağaza}" } },
        { headers: admin.headers }
      )
      const [entry] = await auditEntries("seo")

      expect(before.data.version).toBe(0)
      expect(saved.data.version).toBe(1)
      expect(saved.data.values.title_templates).toMatchObject({
        brand: "{marka} Bıçakları | {mağaza}",
        category: "{kategori} Modelleri ve Fiyatları | {mağaza}",
      })
      expect(entry?.changes?.diff).toEqual({
        "title_templates.brand": {
          before: "{marka} Ürünleri | {mağaza}",
          after: "{marka} Bıçakları | {mağaza}",
        },
      })
    })

    it("keeps both of two saves sent at once, each with its own audit entry (review L2)", async () => {
      const save = (body: Record<string, unknown>) =>
        http.post<{ version: number }>("/admin/platform-settings/store", body, {
          headers: admin.headers,
        })
      const saved = await Promise.all([
        save({ contact_email: "destek@example.com" }),
        save({ weight_unit: "kg" }),
      ])
      const after = await http.get<{ version: number; values: Record<string, unknown> }>(
        "/admin/platform-settings/store",
        { headers: admin.headers }
      )
      const entries = await auditEntries("store", (each) => each.length >= 2)

      // Each answer reads the row back after its save: the later one may already be in
      expect(saved.map(({ status }) => status)).toEqual([200, 200])
      expect(after.data.version).toBe(2)
      expect(after.data.values).toMatchObject({
        contact_email: "destek@example.com",
        weight_unit: "kg",
      })
      // Each entry says only its own field: neither save merged over a stale row
      expect(entries.map((entry) => Object.keys(entry.changes?.diff ?? {})).sort()).toEqual([
        ["contact_email"],
        ["weight_unit"],
      ])
    })

    it("refuses an unknown token, an unknown field and an unknown section", async () => {
      const post = (path: string, body: unknown) =>
        settle(http.post<{ message?: string }>(path, body, { headers: admin.headers }))

      const token = await post("/admin/platform-settings/seo", {
        title_templates: { product: "{fiyat} | {mağaza}" },
      })
      const field = await post("/admin/platform-settings/store", { stripe_secret: "x" })
      const section = await settle(
        http.get("/admin/platform-settings/secrets", { headers: admin.headers })
      )

      expect(token.status).toBe(400)
      expect(token.data.message).toBe("seo.template_invalid")
      expect(field.status).toBe(400)
      expect(section.status).toBe(404)
    })

    it("checks a section by the name Express decodes, and keeps settings from API keys", async () => {
      const encoded = await settle(
        http.post(
          "/admin/platform-settings/%73tore",
          { weight_unit: "ton" },
          { headers: admin.headers }
        )
      )
      const nul = await settle(
        http.post(
          "/admin/platform-settings/seo",
          { title_templates: { product: "{ürün_adı}\u0000" } },
          { headers: admin.headers }
        )
      )
      const { result } = await createApiKeysWorkflow(getContainer()).run({
        input: { api_keys: [{ title: "integration", type: "secret", created_by: "user_test" }] },
      })
      const basic = Buffer.from(`${result[0]?.token ?? ""}:`).toString("base64")
      const byKey = await settle(
        http.post(
          "/admin/platform-settings/store",
          { weight_unit: "kg" },
          { headers: { authorization: `Basic ${basic}` } }
        )
      )

      expect(encoded.status).toBe(400)
      expect(nul.status).toBe(400)
      expect(byKey.status).toBe(403)
    })
  },
})
