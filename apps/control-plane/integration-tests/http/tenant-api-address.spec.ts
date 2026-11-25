import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import {
  addressRequestsInFlight,
  resetAddressInFlight,
  tuneAddressInFlight,
} from "../../src/api/http/address-in-flight"
import { fleetIn } from "../../src/workflows/modules"
import { ensureSigningKey } from "../helpers/fleet"
import { chatBody, sendCall, signedCall, startFakeProvider } from "../helpers/ai-provider"
import type { CallReply, FakeProvider } from "../helpers/ai-provider"
import { aiShop, routeAll } from "../helpers/ai-shops"
import { openCall, until } from "../helpers/open-call"
import type { OpenCall } from "../helpers/open-call"
import { makeMember } from "../helpers/staff"
import type { HttpClient, Member } from "../helpers/staff"

jest.setTimeout(240 * 1000)

/**
 * PR #374 review Y1: the address budget is counted once an answer is out,
 * so a flood sent at once saw it unspent. An address now holds at most
 * its cap of requests not yet vouched for: a flood past it is refused 429
 * before the guard looks up a single key; a verified shop's calls give
 * their slot back once the guard passes them, so long calls never hold
 * their address.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: Member
    let provider: FakeProvider

    beforeAll(async () => {
      owner = await makeMember(http, getContainer(), "owner")
      await ensureSigningKey(getContainer())
      provider = await startFakeProvider()
    })
    afterAll(async () => {
      await provider.close()
    })
    beforeEach(async () => {
      provider.seen.length = 0
      provider.answer({})
      await routeAll(getContainer())
    })
    afterEach(() => {
      tuneAddressInFlight(null)
      resetAddressInFlight()
      jest.restoreAllMocks()
    })

    const shop = () => aiShop(http, getContainer(), owner, { monthly: 100 })
    const base = () => new URL(String((api as { defaults: { baseURL?: string } }).defaults.baseURL))

    // Sent whole on its own connection, as the held calls are (one client address)
    const whole = async (call: ReturnType<typeof signedCall>) => {
      const sent = openCall(base(), call, call.bytes.length)
      const answer = await sent.answered
      sent.client.destroy()
      return [answer.status, (JSON.parse(answer.body) as { message?: unknown }).message]
    }

    it("refuses an unsigned flood past the cap before any key is looked up", async () => {
      const who = await shop()
      tuneAddressInFlight(3)
      // Three calls whose bodies never end hold the address's three slots
      const held: OpenCall[] = []
      for (let i = 0; i < 3; i += 1) {
        held.push(openCall(base(), signedCall(who, chatBody()), 10))
      }
      await until(() => addressRequestsInFlight() === 3)
      const lookups = jest.spyOn(fleetIn(getContainer()), "trustedTenantKey")
      // A forged flood, sent at once: its bytes changed after signing
      const forged = () => signedCall(who, chatBody(), { sentBody: chatBody({ max_tokens: 1 }) })
      const flood = await Promise.all(Array.from({ length: 20 }, () => whole(forged())))
      expect(flood).toEqual(Array.from({ length: 20 }, () => [429, "errors.too_many_requests"]))
      expect(lookups).not.toHaveBeenCalled()
      for (const call of held) {
        call.client.destroy()
      }
      await until(() => addressRequestsInFlight() === 0)
      // A slot free: a forged call reaches the guard and is refused there
      expect(await whole(forged())).toEqual([401, "signature.invalid"])
      expect(lookups).toHaveBeenCalledTimes(1)
      // A shop's own call is untouched
      const signed = await sendCall(http, signedCall(who, chatBody()))
      expect(signed.status).toBe(200)
      expect(provider.seen).toHaveLength(1)
      expect(addressRequestsInFlight()).toBe(0)
    })

    it("never lets a verified shop's long calls hold its address", async () => {
      const who = await shop()
      tuneAddressInFlight(1)
      provider.answer({ delayMs: 1_500 })
      // Each sent once the one before is with the provider: past the guard
      const calls: Promise<CallReply>[] = []
      for (let i = 0; i < 3; i += 1) {
        calls.push(sendCall(http, signedCall(who, chatBody())))
        await until(() => provider.seen.length === i + 1)
        expect(addressRequestsInFlight()).toBe(0)
      }
      const replies = await Promise.all(calls)
      expect(replies.map((reply) => reply.status)).toEqual([200, 200, 200])
      expect(addressRequestsInFlight()).toBe(0)
    })
  },
})
