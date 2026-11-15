import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { adminOrigin, keyOf, sessionCookie } from "../helpers/staff-account"
import type { Answer } from "../helpers/staff-account"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

interface Opened {
  id: string
  path: string
  url: string
  expires_at: string
  idle_ms: number
}

interface SessionAnswer {
  layout: { home: { id: string }[] }
  edition: string
}

/**
 * adr/0065 §1 (Faz 1): the theme editor's live preview session. One stable
 * token while the editor is open: it reads the draft as last saved after
 * every save, for the owner and admins only, from a signed-in panel
 * session; renewed and closed by its own member; ended by a sign-out or a
 * role taken away; never a design link, never kept by anyone.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    /** A panel sign-in: the session cookie, with the origin a cookie's write needs. */
    const panel = async (bearer: Record<string, string>) => {
      const cookie = sessionCookie(await http.post("/auth/session", {}, { headers: bearer }))
      return { cookie, origin: adminOrigin() }
    }
    const saveDraft = (headers: Record<string, string>, home: Record<string, unknown>[] = []) =>
      settle(
        http.post(
          "/admin/storefront-layout",
          { document: { header: [], home, footer: [] } },
          { headers }
        )
      )
    const open = (headers: Record<string, string>) =>
      settle(http.post<Opened & Answer>("/admin/storefront-layout/editor-session", {}, { headers }))
    const tokenOf = (opened: { path: string }) => opened.path.split("/").pop() ?? ""

    it("opens one stable session that reads every later save, never kept", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const store = await createStorefront(container)
      const browser = await panel(owner.plain)
      expect((await saveDraft(owner.headers)).status).toBe(200)

      const opened = await open(browser)
      expect(opened.status).toBe(200)
      expect(opened.headers["cache-control"]).toContain("no-store")
      expect(opened.data.id).toMatch(/^sfs_[0-9a-f]{32}$/)
      expect(opened.data.path).toMatch(/^\/onizleme\/sfs_[0-9a-f]{32}\.[0-9a-z]+\.[\w-]{43}$/)
      expect(opened.data.idle_ms).toBe(30 * 60 * 1000)
      const token = tokenOf(opened.data)
      const read = () =>
        settle(
          http.get<SessionAnswer & Answer>(`/store/storefront-layout/session/${token}`, {
            headers: store.headers,
          })
        )

      const first = await read()
      expect(first.status).toBe(200)
      expect(first.headers["cache-control"]).toBe("private, no-store")
      expect(first.data.layout.home).toEqual([])

      // Saved again: the same token shows the new draft, with a later edition
      const saved = await saveDraft(owner.headers, [
        {
          id: "yardim01a",
          type: "help",
          visible: true,
          starts_at: null,
          ends_at: null,
          title: "Bize yazın",
          text: null,
        },
      ])
      expect(saved.status).toBe(200)
      const second = await read()
      expect(second.status).toBe(200)
      expect(second.data.layout.home.map((section) => section.id)).toEqual(["yardim01a"])
      expect(new Date(second.data.edition).getTime()).toBeGreaterThanOrEqual(
        new Date(first.data.edition).getTime()
      )

      // Altered, or of another kind, it opens nothing
      const altered = await settle(
        http.get(`/store/storefront-layout/session/${token.slice(0, -2)}xx`, {
          headers: store.headers,
        })
      )
      expect(altered.status).toBe(404)
      expect(altered.headers["cache-control"]).toBe("private, no-store")
      const asDesignLink = await settle(
        http.get(`/store/storefront-layout/preview/${token}`, { headers: store.headers })
      )
      expect(asDesignLink.status).toBe(404)
      const design = await settle(
        http.post<{ path: string }>(
          "/admin/storefront-layout/preview",
          {},
          { headers: owner.headers }
        )
      )
      const asSession = await settle(
        http.get(`/store/storefront-layout/session/${tokenOf(design.data)}`, {
          headers: store.headers,
        })
      )
      expect(asSession.status).toBe(404)
    })

    it("is renewed and closed by its own member; closed, it opens nothing", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const admin = await createAdminUser(http, container, "admin")
      const store = await createStorefront(container)
      const mine = await panel(owner.plain)
      const theirs = await panel(admin.plain)
      await saveDraft(owner.headers)
      const opened = (await open(mine)).data
      const token = tokenOf(opened)
      const read = () =>
        settle(http.get(`/store/storefront-layout/session/${token}`, { headers: store.headers }))
      const at = `/admin/storefront-layout/editor-session/${opened.id}`

      expect((await settle(http.put(at, {}, { headers: theirs }))).status).toBe(404)
      expect((await settle(http.delete(at, { headers: theirs }))).data).toMatchObject({
        deleted: false,
      })
      expect((await read()).status).toBe(200)
      expect((await settle(http.put(at, {}, { headers: mine }))).status).toBe(200)

      const closed = await settle(http.delete(at, { headers: mine }))
      expect(closed.data).toMatchObject({ deleted: true })
      expect((await read()).status).toBe(404)
      expect((await settle(http.put(at, {}, { headers: mine }))).status).toBe(404)
    })

    it("is the owner's and admins' only, from a signed-in panel session", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      await saveDraft(owner.headers)

      // A bearer token alone has no panel session to bind to
      const bearer = await open(owner.headers)
      expect(bearer.status).toBe(400)
      expect(keyOf(bearer.data)).toBe("storefront_layout.session_needs_sign_in")

      const admin = await createAdminUser(http, container, "admin")
      expect((await open(await panel(admin.plain))).status).toBe(200)
      for (const role of ["operations", "readonly"] as const) {
        const member = await createAdminUser(http, container, role)
        expect((await open(await panel(member.plain))).status).toBe(403)
      }
    })

    it("ends with a sign-out and with the design role taken away", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const admin = await createAdminUser(http, container, "admin")
      const store = await createStorefront(container)
      await saveDraft(owner.headers)
      const read = (token: string) =>
        settle(http.get(`/store/storefront-layout/session/${token}`, { headers: store.headers }))

      const leaving = await panel(owner.plain)
      const signedOut = tokenOf((await open(leaving)).data)
      expect((await read(signedOut)).status).toBe(200)
      await settle(http.delete("/auth/session", { headers: leaving }))
      expect((await read(signedOut)).status).toBe(404)

      const demoted = tokenOf((await open(await panel(admin.plain))).data)
      expect((await read(demoted)).status).toBe(200)
      const changed = await settle(
        http.post(
          `/admin/staff/members/${admin.userId}`,
          { role: "operations" },
          { headers: owner.headers }
        )
      )
      expect(changed.status).toBe(200)
      expect((await read(demoted)).status).toBe(404)
    })
  },
})
