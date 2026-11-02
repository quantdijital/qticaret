import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

interface Site {
  maintenance: {
    enabled: boolean
    title: string | null
    message: string | null
    expected_at: string | null
    allow_paths: string[]
  }
}

interface Link {
  url: string
  path: string
  expires_at: string
}

const tokenOf = (link: Link): string =>
  new URL(link.path, "https://magaza.test").searchParams.get("t") ?? ""

/** adr/0053: maintenance mode, the owner's switch, and the link past it. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const save = (headers: Record<string, string>, body: unknown) =>
      settle(http.post("/admin/platform-settings/maintenance", body, { headers }))

    it("lets only the owner turn the shop dark, and tells the storefront with the details filled", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const admin = await createAdminUser(http, container, "admin")
      const ops = await createAdminUser(http, container, "operations")
      const store = await createStorefront(container)
      const site = () => settle(http.get<Site>("/store/seo/site", { headers: store.headers }))

      const before = await site()
      const byAdmin = await save(admin.headers, { enabled: true })
      const byOps = await save(ops.headers, { enabled: true })
      const misspelt = await save(owner.headers, { message: "{ucretsiz_kargo} üzeri kargo bedava" })
      const everything = await save(owner.headers, { allow_paths: ["/*"] })
      // Prepared while open: nothing of it reaches the storefront yet
      const prepared = await save(owner.headers, {
        title: "Yakında açılıyoruz",
        message: "{ücretsiz_kargo_eşiği} üzeri kargo bedava.",
        expected_at: "2026-11-10T09:00:00+03:00",
        allow_paths: ["/Iletisim/", "/sozlesmeler/*"],
      })
      const whilePrepared = await site()
      await settle(
        http.post(
          "/admin/platform-settings/promotions",
          { free_shipping_threshold: 1500 },
          { headers: owner.headers }
        )
      )
      const turnedOn = await save(owner.headers, { enabled: true })
      const dark = await site()
      const adminReads = await settle(
        http.get("/admin/platform-settings/maintenance", { headers: admin.headers })
      )

      const off = { enabled: false, title: null, message: null, expected_at: null, allow_paths: [] }
      expect(before.status).toBe(200)
      expect(before.data.maintenance).toEqual(off)
      // Where the shop goes dark is the owner's (adr/0040), as 2FA is
      expect([byAdmin.status, byOps.status]).toEqual([403, 403])
      expect(byAdmin.data).toMatchObject({ message: "staff.forbidden" })
      expect(misspelt.status).toBe(400)
      expect(JSON.stringify(misspelt.data)).toContain("platform_settings.token_unknown")
      expect(everything.status).toBe(400)
      expect(prepared.status).toBe(200)
      expect(whilePrepared.data.maintenance).toEqual(off)
      expect(turnedOn.status).toBe(200)
      expect(dark.data.maintenance).toEqual({
        enabled: true,
        title: "Yakında açılıyoruz",
        // The threshold as the promotions section says it now (adr/0048)
        message: "₺1.500 üzeri kargo bedava.",
        expected_at: "2026-11-10T09:00:00+03:00",
        allow_paths: ["/iletisim", "/sozlesmeler/*"],
      })
      expect(adminReads.status).toBe(200)
    })

    it("opens the dark shop for a bypass link until the section is saved again", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const admin = await createAdminUser(http, container, "admin")
      const ops = await createAdminUser(http, container, "operations")
      const store = await createStorefront(container)
      const link = (headers: Record<string, string>) =>
        settle(http.post<Link>("/admin/maintenance/bypass", {}, { headers }))
      const check = (token: string) =>
        settle(
          http.get(`/store/maintenance/bypass/${encodeURIComponent(token)}`, {
            headers: store.headers,
          })
        )

      const whileOpen = await link(owner.headers)
      await save(owner.headers, { enabled: true })
      const made = await link(admin.headers)
      const byOps = await link(ops.headers)
      const withBody = await settle(
        http.post("/admin/maintenance/bypass", { version: 1 }, { headers: owner.headers })
      )
      const token = tokenOf(made.data)
      const valid = await check(token)
      const [id = "", expires = ""] = token.split(".")
      const forged = await check(`${id}.${expires}.${"A".repeat(43)}`)
      const garbage = await check("mnb_nothing")
      await save(owner.headers, { enabled: false })
      const whileOff = await check(token)
      await save(owner.headers, { enabled: true })
      const afterToggle = await check(token)
      const fresh = await link(owner.headers)
      const freshCheck = await check(tokenOf(fresh.data))
      // Any save of the section ends the links made before it
      await save(owner.headers, { title: "Bakımdayız" })
      const afterEdit = await check(tokenOf(fresh.data))
      const audit = await eventually(
        () =>
          http.get<{ audit_entries: { action: string; outcome: number }[] }>(
            "/admin/audit-log?resource_type=maintenance&kind=mutation",
            { headers: owner.headers }
          ),
        (answer) => answer.data.audit_entries.filter((entry) => entry.outcome === 200).length >= 2
      )

      expect(whileOpen.status).toBe(400)
      expect(JSON.stringify(whileOpen.data)).toContain("maintenance.not_enabled")
      // A link to look, as a draft's preview: the admin's too, not operations'
      expect(made.status).toBe(200)
      expect(made.data.path).toMatch(/^\/bakim\/gir\?t=mnb_[\w-]{16}\.[0-9a-z]+\.[\w-]{43}$/)
      // No canonical host yet: the path alone
      expect(made.data.url).toBe(made.data.path)
      const days = (Date.parse(made.data.expires_at) - Date.now()) / 86_400_000
      expect(days).toBeGreaterThan(6.9)
      expect(days).toBeLessThanOrEqual(7)
      expect(byOps.status).toBe(403)
      expect(withBody.status).toBe(400)
      expect(valid.status).toBe(204)
      expect(valid.headers["cache-control"]).toBe("private, no-store")
      expect([forged.status, garbage.status]).toEqual([404, 404])
      expect(whileOff.status).toBe(404)
      expect(afterToggle.status).toBe(404)
      expect(freshCheck.status).toBe(204)
      expect(afterEdit.status).toBe(404)
      // Each link made is in the audit log (adr/0011)
      expect(
        audit.data.audit_entries.filter(
          (entry) => entry.action === "POST /admin/maintenance/bypass" && entry.outcome === 200
        )
      ).toHaveLength(2)
    })
  },
})
