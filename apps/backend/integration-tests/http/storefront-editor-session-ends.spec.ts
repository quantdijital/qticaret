import { randomUUID } from "node:crypto"
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
}

/**
 * adr/0065 §1 (Faz 1), security review 2026-11-15: the theme editor's live
 * preview session ends with the panel session it was opened from (a
 * password change, "end other sessions"); it is opened from one identity
 * only (a session cookie with a bearer token beside it opens nothing); and
 * only the panel session it was opened from keeps it alive.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    /** A panel sign-in: the session cookie, with the origin a cookie's write needs. */
    const panel = async (bearer: Record<string, string>) => {
      const cookie = sessionCookie(await http.post("/auth/session", {}, { headers: bearer }))
      return { cookie, origin: adminOrigin() }
    }
    const saveDraft = (headers: Record<string, string>) =>
      settle(
        http.post(
          "/admin/storefront-layout",
          { document: { header: [], home: [], footer: [] } },
          { headers }
        )
      )
    const open = (headers: Record<string, string>) =>
      settle(http.post<Opened & Answer>("/admin/storefront-layout/editor-session", {}, { headers }))
    const tokenOf = (opened: { path: string }) => opened.path.split("/").pop() ?? ""

    async function setup(role: "owner" | "admin" = "owner") {
      const container = getContainer()
      const member = await createAdminUser(http, container, role)
      const store = await createStorefront(container)
      await saveDraft(member.headers)
      const read = (token: string) =>
        settle(http.get(`/store/storefront-layout/session/${token}`, { headers: store.headers }))
      return { member, read }
    }

    it("ends with a password change, the changing panel session's own included", async () => {
      const { member, read } = await setup()
      const here = await panel(member.plain)
      const there = await panel(member.plain)
      const fromHere = tokenOf((await open(here)).data)
      const fromThere = tokenOf((await open(there)).data)
      expect((await read(fromHere)).status).toBe(200)
      expect((await read(fromThere)).status).toBe(200)

      const changed = await settle(
        http.post(
          "/admin/staff/me/password",
          { current_password: member.password, new_password: randomUUID() },
          { headers: here }
        )
      )
      expect(changed.status).toBe(200)

      // The other panel session ended; this one has a new id, so its session is gone too
      expect((await read(fromThere)).status).toBe(404)
      expect((await read(fromHere)).status).toBe(404)
      // The renewed panel session opens a fresh one
      const renewed = { cookie: sessionCookie(changed), origin: adminOrigin() }
      const again = await open(renewed)
      expect(again.status).toBe(200)
      expect((await read(tokenOf(again.data))).status).toBe(200)
    })

    it("ends with 'end other sessions', the asking panel session's kept", async () => {
      const { member, read } = await setup("admin")
      const here = await panel(member.plain)
      const there = await panel(member.plain)
      const kept = tokenOf((await open(here)).data)
      const ended = tokenOf((await open(there)).data)

      const answer = await settle(
        http.post<{ ended: number }>(
          "/admin/staff/me/sessions/end-others",
          {},
          {
            headers: {
              ...here,
              "x-reauth-method": "password",
              "x-reauth-secret": encodeURIComponent(member.password),
            },
          }
        )
      )
      expect(answer.data.ended).toBe(1)
      expect((await read(ended)).status).toBe(404)
      expect((await read(kept)).status).toBe(200)
    })

    it("opens nothing for a session cookie sent with a bearer token, either's or another's", async () => {
      const container = getContainer()
      const a = await createAdminUser(http, container)
      const b = await createAdminUser(http, container, "admin")
      await saveDraft(a.headers)
      const cookieA = await panel(a.plain)

      for (const bearer of [b.plain, a.plain]) {
        const mixed = await open({ ...cookieA, ...bearer })
        expect(mixed.status).toBe(400)
        expect(keyOf(mixed.data)).toBe("storefront_layout.session_needs_sign_in")
      }
      // The cookie alone opens it, as A
      expect((await open(cookieA)).status).toBe(200)
    })

    it("is kept alive only by the panel session it was opened from", async () => {
      const { member, read } = await setup()
      const here = await panel(member.plain)
      const elsewhere = await panel(member.plain)
      const opened = (await open(here)).data
      const at = `/admin/storefront-layout/editor-session/${opened.id}`

      // The same member from another panel session, by bearer, or with both: a 404
      expect((await settle(http.put(at, {}, { headers: elsewhere }))).status).toBe(404)
      expect((await settle(http.put(at, {}, { headers: member.plain }))).status).toBe(404)
      expect(
        (await settle(http.put(at, {}, { headers: { ...here, ...member.plain } }))).status
      ).toBe(404)
      expect((await settle(http.put(at, {}, { headers: here }))).status).toBe(200)
      expect((await read(tokenOf(opened))).status).toBe(200)

      // Signed out of the panel session it was opened from: renewing finds nothing
      await settle(http.delete("/auth/session", { headers: here }))
      expect((await settle(http.put(at, {}, { headers: here }))).status).toBe(401)
      expect((await read(tokenOf(opened))).status).toBe(404)
    })
  },
})
