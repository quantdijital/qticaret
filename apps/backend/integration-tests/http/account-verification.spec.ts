import { randomUUID } from "node:crypto"
import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

/**
 * F15.1 (F14 closing review): a code confirms an address only in the
 * session of the identity that asked for it, so nobody can have a
 * stranger confirm the stranger's address for an account they opened.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    const register = async (email: string) =>
      (
        await http.post<{ token: string }>("/auth/customer/emailpass/register", {
          email,
          password: randomUUID(),
        })
      ).data.token

    /** Asks for a code as the identity, and reads it where the mailbox would (the event). */
    const codeFor = async (token: string, email: string): Promise<string> => {
      const bus = getContainer().resolve(Modules.EVENT_BUS)
      const subscriberId = `verify-${randomUUID()}`
      let deliver: (code: string) => void = () => undefined
      const received = new Promise<string>((resolve) => {
        deliver = resolve
      })
      bus.subscribe(
        "auth.verification_requested",
        ({ data }: { data: unknown }) => {
          const event = data as { entity_id?: string; code?: string }
          if (event.entity_id === email && event.code) {
            deliver(event.code)
          }
          return Promise.resolve()
        },
        { subscriberId }
      )
      await http.post(
        "/auth/verification/request",
        { entity_id: email, entity_type: "email" },
        { headers: { authorization: `Bearer ${token}` } }
      )
      return received
    }
    const confirm = (code: string, token?: string) =>
      settle(
        http.post<{ verified_at?: string; message?: string }>(
          "/auth/verification/confirm",
          { code },
          token ? { headers: { authorization: `Bearer ${token}` } } : {}
        )
      )

    it("confirms a code only in its own identity's session", async () => {
      const victim = `kurban-${String(Date.now())}@example.com`
      // Someone registers with the victim's address; the code goes to the victim's mailbox
      const intruder = await register(victim)
      const code = await codeFor(intruder, victim)

      // The victim opens the link without the intruder's session: refused
      const bare = await confirm(code)
      expect(bare.status).toBe(401)
      expect(bare.data.message).toBe("account.verification_session_required")

      // Another identity's session: the code answers as an unknown one, nothing confirmed
      const other = await register(`baska-${String(Date.now())}@example.com`)
      const foreign = await confirm(code, other)
      expect(foreign.status).toBe(400)
      const [verification] = await getContainer()
        .resolve(Modules.AUTH)
        .listAuthVerifications({ entity_id: victim }, { take: 1 })
      expect(verification?.verified_at).toBeNull()

      // In its own session it confirms
      const own = await confirm(code, intruder)
      expect(own.status).toBe(200)
      expect(own.data.verified_at).toBeDefined()
    })

    it("ends a token given before the password changed: no refresh, no account from it", async () => {
      const victim = `sifirlayan-${String(Date.now())}@example.com`
      const intruder = await register(victim)
      // A token's time is in seconds: the change comes in a later one
      await new Promise((resolve) => setTimeout(resolve, 1_100))

      // The victim, unable to register, resets the password through the mailed link
      const bus = getContainer().resolve(Modules.EVENT_BUS)
      const subscriberId = `reset-${randomUUID()}`
      let deliver: (token: string) => void = () => undefined
      const mailed = new Promise<string>((resolve) => {
        deliver = resolve
      })
      bus.subscribe(
        "auth.password_reset",
        ({ data }: { data: unknown }) => {
          const event = data as { entity_id?: string; token?: string }
          if (event.entity_id === victim && event.token) {
            deliver(event.token)
          }
          return Promise.resolve()
        },
        { subscriberId }
      )
      await http.post("/auth/customer/emailpass/reset-password", { identifier: victim })
      const resetToken = await mailed
      const password = randomUUID()
      const updated = await settle(
        http.post(
          "/auth/customer/emailpass/update",
          { password },
          { headers: { authorization: `Bearer ${resetToken}` } }
        )
      )
      expect(updated.status).toBe(200)
      const auth = getContainer().resolve(Modules.AUTH)
      const [provider] = await auth.listProviderIdentities({
        entity_id: victim,
        provider: "emailpass",
      })
      for (let tries = 0; tries < 30; tries++) {
        const identity = await auth.retrieveAuthIdentity(provider?.auth_identity_id ?? "")
        if (identity.app_metadata?.["password_changed_at"]) {
          break
        }
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      const store = await createStorefront(getContainer())
      const refreshed = await settle(
        http.post<{ message?: string }>(
          "/auth/token/refresh",
          {},
          {
            headers: { authorization: `Bearer ${intruder}` },
          }
        )
      )
      expect(refreshed.status).toBe(401)
      expect(refreshed.data.message).toBe("account.token_before_password_change")
      const opened = await settle(
        http.post(
          "/store/customers",
          { email: victim, first_name: "Saldırgan" },
          { headers: { ...store.headers, authorization: `Bearer ${intruder}` } }
        )
      )
      expect(opened.status).toBe(401)

      // The victim's own sign-in after the change is not refused by it
      const signedIn = await http.post<{ token: string }>("/auth/customer/emailpass", {
        email: victim,
        password,
      })
      const own = await settle(
        http.post(
          "/store/customers",
          { email: victim, first_name: "Kurban" },
          { headers: { ...store.headers, authorization: `Bearer ${signedIn.data.token}` } }
        )
      )
      expect(own.status).toBe(200)
    })
  },
})
