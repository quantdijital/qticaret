import { randomUUID } from "node:crypto"
import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

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
  },
})
