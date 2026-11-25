import {
  MemoryNonceStore,
  privateKeyFromSeed,
  signerFromPrivateKey,
  verifySignedRequest,
} from "@qticaret/server-kit"
import { AI_CREDITS_PATHS } from "@qticaret/types/control-plane"
import type { AiCreditsStatus } from "@qticaret/types/control-plane"
import { FIXED_NOW, TENANT_ID, TEST_ONLY_TENANT_SEED } from "@qticaret/types/control-plane/testing"
import { forgetProcessCaches } from "../../cache/process-caches"
import { logger } from "../../logging"
import {
  AI_CREDITS_CACHE_MS,
  AI_CREDITS_FAILURE_CACHE_MS,
  aiCreditsStatus,
  noteAiCharge,
} from "../ai-credits"

/** adr/0085 §3 (P4a): the platform's credits as the control plane says, kept a minute. */

const shop = signerFromPrivateKey(privateKeyFromSeed(TEST_ONLY_TENANT_SEED))
const ENDPOINT = { url: "http://control-plane.internal:9000", tenantId: TENANT_ID, signer: shop }

const AVAILABLE: AiCreditsStatus = {
  available: true,
  balance: {
    plan: { remaining: 30, renews_on: "2026-12-01" },
    purchased: { remaining: 100, expires_on: "2027-11-01" },
  },
  daily: { cap: 300, remaining: 280 },
  services: { text: "deepseek", image_edit: "photoroom" },
  table: { seo_title: 1, image_scene: 40 },
  packs: [],
  pending_order: null,
}

function controlPlane(answer: () => Response | Promise<Response>) {
  const received: { url: string; init: RequestInit }[] = []
  const fetch = async (url: string, init: RequestInit) => {
    received.push({ url, init })
    return answer()
  }
  return { fetch, received }
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

let clock = FIXED_NOW
const now = () => clock

beforeEach(() => {
  forgetProcessCaches()
  clock = FIXED_NOW
})

describe("the platform's credits status", () => {
  it("asks once, signed, and keeps the answer a minute", async () => {
    const { fetch, received } = controlPlane(() => json(AVAILABLE))
    await expect(aiCreditsStatus({ endpoint: ENDPOINT, fetch, now })).resolves.toEqual(AVAILABLE)
    clock += AI_CREDITS_CACHE_MS - 1
    await expect(aiCreditsStatus({ endpoint: ENDPOINT, fetch, now })).resolves.toEqual(AVAILABLE)
    expect(received).toHaveLength(1)
    const [sent] = received
    if (sent === undefined) {
      throw new Error("nothing was sent")
    }
    expect(sent.url).toBe(`${ENDPOINT.url}${AI_CREDITS_PATHS.credits}`)
    expect(sent.init).toMatchObject({ method: "GET", redirect: "error" })
    const verified = await verifySignedRequest(
      {
        method: "GET",
        path: AI_CREDITS_PATHS.credits,
        headers: sent.init.headers as Record<string, string>,
        body: "",
      },
      { publicKey: () => shop.privateKey, nonces: new MemoryNonceStore(), now: () => FIXED_NOW }
    )
    expect(verified).toMatchObject({ ok: true, tenantId: TENANT_ID })
    clock += 1
    await aiCreditsStatus({ endpoint: ENDPOINT, fetch, now })
    expect(received).toHaveLength(2)
  })

  it("asks nobody on a shop without a control plane", async () => {
    const { fetch, received } = controlPlane(() => json(AVAILABLE))
    await expect(aiCreditsStatus({ endpoint: null, fetch, now })).resolves.toEqual({
      available: false,
    })
    expect(received).toHaveLength(0)
  })

  it("drops a field a newer control plane adds and reads the rest (P5b)", async () => {
    const newer = {
      ...AVAILABLE,
      model: "deepseek-flash",
      balance: {
        ...AVAILABLE.balance,
        plan: { ...AVAILABLE.balance.plan, carried_over: 12 },
      },
      daily: { ...AVAILABLE.daily, resets_at: "2026-11-26T00:00:00Z" },
    }
    const { fetch } = controlPlane(() => json(newer))
    await expect(aiCreditsStatus({ endpoint: ENDPOINT, fetch, now })).resolves.toEqual(AVAILABLE)
  })

  it.each([
    ["unreachable", () => Promise.reject(new TypeError("fetch failed"))],
    ["refused", () => json({ error: "signature.invalid" }, 401)],
    ["failing", () => json({}, 500)],
    ["not JSON", () => new Response("<html>")],
    ["of another shape", () => json({ ...AVAILABLE, daily: "none" })],
    ["a balance below zero", () => json({ ...AVAILABLE, daily: { cap: 300, remaining: -1 } })],
    ["too large", () => new Response(" ".repeat(17 * 1024) + JSON.stringify(AVAILABLE))],
  ])("%s: not available, kept a shorter while", async (_case, answer) => {
    const failing = controlPlane(answer)
    await expect(
      aiCreditsStatus({ endpoint: ENDPOINT, fetch: failing.fetch, now })
    ).resolves.toEqual({
      available: false,
    })
    clock += AI_CREDITS_FAILURE_CACHE_MS
    const working = controlPlane(() => json(AVAILABLE))
    await expect(
      aiCreditsStatus({ endpoint: ENDPOINT, fetch: working.fetch, now })
    ).resolves.toEqual(AVAILABLE)
  })

  it("keeps a not-available answer as it came", async () => {
    const { fetch, received } = controlPlane(() => json({ available: false }))
    await aiCreditsStatus({ endpoint: ENDPOINT, fetch, now })
    await expect(aiCreditsStatus({ endpoint: ENDPOINT, fetch, now })).resolves.toEqual({
      available: false,
    })
    expect(received).toHaveLength(1)
  })
})

describe("the status while the control plane cannot be reached (review D1)", () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  const unreachable = () => controlPlane(() => Promise.reject(new TypeError("fetch failed")))

  it("asks once for ten asks in a row, with one warning, and again after the window", async () => {
    const warn = jest.spyOn(logger, "warn").mockImplementation(() => undefined)
    const { fetch, received } = unreachable()
    for (let each = 0; each < 10; each++) {
      await expect(aiCreditsStatus({ endpoint: ENDPOINT, fetch, now })).resolves.toEqual({
        available: false,
      })
      clock += 1_000
    }
    expect(received).toHaveLength(1)
    expect(warn).toHaveBeenCalledTimes(1)

    clock = FIXED_NOW + AI_CREDITS_FAILURE_CACHE_MS
    await aiCreditsStatus({ endpoint: ENDPOINT, fetch, now })
    expect(received).toHaveLength(2)
    expect(warn).toHaveBeenCalledTimes(2)
  })

  it("keeps a failure shorter than an answer", () => {
    expect(AI_CREDITS_FAILURE_CACHE_MS).toBeLessThan(AI_CREDITS_CACHE_MS)
  })

  it("sends one ask for those asking at once, each given its answer", async () => {
    let release: (response: Response) => void = () => undefined
    const { fetch, received } = controlPlane(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve
        })
    )
    const asks = Array.from({ length: 5 }, () =>
      aiCreditsStatus({ endpoint: ENDPOINT, fetch, now })
    )
    await new Promise((resolve) => setImmediate(resolve))
    release(json(AVAILABLE))
    await expect(Promise.all(asks)).resolves.toEqual(Array.from({ length: 5 }, () => AVAILABLE))
    expect(received).toHaveLength(1)
  })

  it("sends one ask for those asking at once while it fails", async () => {
    jest.spyOn(logger, "warn").mockImplementation(() => undefined)
    const { fetch, received } = unreachable()
    const answers = await Promise.all(
      Array.from({ length: 5 }, () => aiCreditsStatus({ endpoint: ENDPOINT, fetch, now }))
    )
    expect(answers).toEqual(Array.from({ length: 5 }, () => ({ available: false })))
    expect(received).toHaveLength(1)
  })
})

describe("a call's charge on the kept status", () => {
  async function keptAfter(charge: { credits: number; balance: number }) {
    const { fetch, received } = controlPlane(() => json(AVAILABLE))
    await aiCreditsStatus({ endpoint: ENDPOINT, fetch, now })
    noteAiCharge(charge)
    const status = await aiCreditsStatus({ endpoint: ENDPOINT, fetch, now })
    return { status, asked: received.length }
  }

  it("comes off the month's grant first, then the bought credits, and off the day", async () => {
    const grant = await keptAfter({ credits: 10, balance: 120 })
    expect(grant.asked).toBe(1)
    expect(grant.status).toMatchObject({
      balance: { plan: { remaining: 20 }, purchased: { remaining: 100 } },
      daily: { remaining: 270 },
    })
    forgetProcessCaches()
    const bought = await keptAfter({ credits: 40, balance: 90 })
    expect(bought.status).toMatchObject({
      balance: { plan: { remaining: 0 }, purchased: { remaining: 90 } },
      daily: { remaining: 240 },
    })
  })

  it("reads the month's whole grant when sent and keeps it through a charge (P5b)", async () => {
    const plan = { remaining: 30, renews_on: "2026-12-01", granted: 200 }
    const { fetch } = controlPlane(() =>
      json({ ...AVAILABLE, balance: { ...AVAILABLE.balance, plan } })
    )
    expect(await aiCreditsStatus({ endpoint: ENDPOINT, fetch, now })).toMatchObject({
      balance: { plan },
    })
    noteAiCharge({ credits: 10, balance: 120 })
    expect(await aiCreditsStatus({ endpoint: ENDPOINT, fetch, now })).toMatchObject({
      balance: { plan: { remaining: 20, granted: 200 } },
    })
  })

  it("forgets a wallet that grew meanwhile, and asks again", async () => {
    const grown = await keptAfter({ credits: 0, balance: 500 })
    expect(grown.asked).toBe(2)
  })

  it("does nothing with nothing kept", () => {
    expect(() => {
      noteAiCharge({ credits: 1, balance: 1 })
    }).not.toThrow()
  })
})
