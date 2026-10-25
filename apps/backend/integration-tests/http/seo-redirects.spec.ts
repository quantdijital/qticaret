import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(120 * 1000)

interface Rule {
  id: string
  source: string
  target: string | null
  status: number
  match: string
}

interface Resolution {
  type: string
  status?: number
  location?: string
}

const product = (title: string) => ({
  title,
  status: "published",
  weight: 250,
  length: 30,
  width: 5,
  height: 2,
  options: [{ title: "Boyut", values: ["Standart"] }],
  variants: [
    {
      title: "Standart",
      options: { Boyut: "Standart" },
      manage_inventory: false,
      prices: [{ currency_code: "try", amount: 1000 }],
    },
  ],
})

/** F3.5 (adr/0017): redirect rules, stored flat, never looping, never hiding a live page. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }

    const post = <T>(url: string, body: unknown) =>
      settle(http.post<T & { message?: string }>(url, body, { headers: admin.headers }))
    const rule = (body: Record<string, unknown>) =>
      post<{ redirect: Rule }>("/admin/seo/redirects", body)
    const resolve = async (path: string) =>
      (
        await http.get<{ resolution: Resolution }>(
          `/admin/seo/resolve?path=${encodeURIComponent(path)}`,
          { headers: admin.headers }
        )
      ).data.resolution
    const listed = async () =>
      (
        await http.get<{ redirects: Rule[] }>("/admin/seo/redirects?limit=100", {
          headers: admin.headers,
        })
      ).data.redirects

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      await post("/admin/products", product("Seramik Kupa"))
    })

    it("sends a request to the rule's target, keeping its query; 410 and nothing too", async () => {
      expect((await rule({ source: "/Eski-Kupa/", target: "/urun/seramik-kupa" })).status).toBe(201)
      await rule({ source: "/kampanya-2024", status: 410 })

      expect(await resolve("/eski-kupa?utm_source=bulten")).toEqual({
        type: "redirect",
        path: "/eski-kupa",
        status: 301,
        location: "/urun/seramik-kupa?utm_source=bulten",
      })
      expect(await resolve("/urun/seramik-kupa")).toMatchObject({
        type: "entity",
        entity_type: "product",
      })
      expect(await resolve("/kampanya-2024")).toMatchObject({ type: "gone" })
      expect(await resolve("/hic-olmayan")).toMatchObject({ type: "not_found" })
    })

    it("stores chains flat in both directions and refuses a loop (KK: 301 chain)", async () => {
      await rule({ source: "/a", target: "/b" })
      await rule({ source: "/b", target: "/urun/seramik-kupa" })
      const forward = await rule({ source: "/c", target: "/a" })

      const bySource = Object.fromEntries(
        (await listed()).map((each) => [each.source, each.target])
      )
      expect(bySource).toEqual({
        "/a": "/urun/seramik-kupa",
        "/b": "/urun/seramik-kupa",
        "/c": "/urun/seramik-kupa",
      })
      expect(forward.data.redirect.target).toBe("/urun/seramik-kupa")

      await rule({ source: "/x", target: "/y" })
      const loop = await rule({ source: "/y", target: "/x" })
      expect(loop.status).toBe(400)
      expect(loop.data.message).toBe("seo.redirect_loop")
    })

    it("follows prefix and pattern rules; the more literal pattern wins", async () => {
      await rule({ source: "/eski-magaza/*", match: "prefix", target: "/kategori" })
      await rule({ source: "/p/:a/:b", match: "pattern", target: "/arama?q=:a" })
      await rule({ source: "/p/urun/:slug", match: "pattern", target: "/urun/:slug" })

      expect(await resolve("/eski-magaza/giyim/gomlek")).toMatchObject({
        location: "/kategori/giyim/gomlek",
      })
      expect(await resolve("/p/urun/seramik-kupa")).toMatchObject({
        type: "redirect",
        location: "/urun/seramik-kupa",
      })

      // A remainder that spells a backend path is sent nowhere
      await rule({ source: "/eski-site", match: "prefix", target: "/" })
      expect(await resolve("/eski-site/admin/orders")).toMatchObject({ type: "not_found" })
      expect(await resolve("/eski-site/kategori")).toMatchObject({ location: "/kategori" })
    })

    it("refuses a live page's path, outside targets, a gone target and a second rule", async () => {
      const live = await rule({ source: "/urun/seramik-kupa", target: "/x" })
      const outside = await rule({ source: "/eski", target: "https://rakip.com/x" })
      await rule({ source: "/kapandi", status: 410 })
      const gone = await rule({ source: "/eski", target: "/kapandi" })
      await rule({ source: "/eski", target: "/urun/seramik-kupa" })
      const twice = await rule({ source: "/eski", target: "/b" })

      expect([live.data.message, outside.data.message, gone.data.message]).toEqual([
        "seo.redirect_source_live",
        "seo.redirect_target_invalid",
        "seo.redirect_target_gone",
      ])
      expect(twice.status).toBe(409)
    })

    it("updates and deletes a rule, and records both field by field", async () => {
      const created = (await rule({ source: "/eski", target: "/urun/seramik-kupa" })).data.redirect
      const updated = await post<{ redirect: Rule }>(`/admin/seo/redirects/${created.id}`, {
        source: "/eski",
        target: "/urun/seramik-kupa",
        status: 302,
      })
      expect(updated.data.redirect.status).toBe(302)
      await http.delete(`/admin/seo/redirects/${created.id}`, { headers: admin.headers })
      expect(await resolve("/eski")).toMatchObject({ type: "not_found" })

      let diff: Record<string, unknown> | undefined
      for (let attempt = 0; attempt < 30 && !diff; attempt++) {
        const { data } = await http.get<{
          audit_entries: { action: string; changes?: { diff?: Record<string, unknown> } }[]
        }>("/admin/audit-log?resource_type=seo_redirect&limit=5", { headers: admin.headers })
        diff = data.audit_entries.find((entry) =>
          entry.action.startsWith("POST /admin/seo/redirects/:id")
        )?.changes?.diff
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      expect(diff).toMatchObject({ status: { before: 301, after: 302 } })
    })

    it("imports a file all or nothing, by line, and exports it back", async () => {
      const file = (rows: string) => `source;target;status\n${rows}`
      const broken = await post<{ applied: boolean; problems: { line: number; code: string }[] }>(
        "/admin/seo/redirect-file",
        {
          csv: file("/bir;/urun/seramik-kupa;301\n/iki;https://rakip.com;301\n/uc;/bir;999"),
          dry_run: false,
        }
      )
      expect(broken.data.applied).toBe(false)
      expect(broken.data.problems.map(({ line, code }) => [line, code])).toEqual([
        [3, "seo.redirect_target_invalid"],
        [4, "seo.redirect_status_invalid"],
      ])
      expect(await listed()).toHaveLength(0)

      const good = file("/bir;/urun/seramik-kupa;301\n/iki;/bir;301")
      const dry = await post<{ created: number }>("/admin/seo/redirect-file", { csv: good })
      expect(dry.data.created).toBe(2)
      expect(await listed()).toHaveLength(0)

      const applied = await post<{ applied: boolean }>("/admin/seo/redirect-file", {
        csv: good,
        dry_run: false,
      })
      expect(applied.data.applied).toBe(true)
      expect((await resolve("/iki")).location).toBe("/urun/seramik-kupa")

      const exported = await http.get<string>("/admin/seo/redirect-file", {
        headers: admin.headers,
        responseType: "text",
      })
      expect(exported.headers["content-type"]).toContain("text/csv")
      expect(exported.data).toContain("/iki;/urun/seramik-kupa;301;exact;keep;")
    })
  },
})
