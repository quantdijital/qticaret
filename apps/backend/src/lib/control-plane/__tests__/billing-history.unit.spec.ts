import {
  MemoryNonceStore,
  privateKeyFromSeed,
  rawPublicKey,
  signDocument,
  signerFromPrivateKey,
  verifySignedRequest,
} from "@qticaret/server-kit"
import { BILLING_HISTORY_PURPOSE, billingHistoryBinding } from "@qticaret/types/control-plane"
import type { BillingHistory, BillingRecord } from "@qticaret/types/control-plane"
import {
  TENANT_ID,
  TEST_ONLY_CP_SEED,
  TEST_ONLY_TENANT_SEED,
} from "@qticaret/types/control-plane/testing"
import {
  BILLING_PATH,
  HISTORY_CACHE_MS,
  forgetPaymentHistory,
  readPaymentHistory,
} from "../billing-history"

const cp = signerFromPrivateKey(privateKeyFromSeed(TEST_ONLY_CP_SEED))
const shop = signerFromPrivateKey(privateKeyFromSeed(TEST_ONLY_TENANT_SEED))
// A key the shop does not trust
const stranger = signerFromPrivateKey(privateKeyFromSeed(Buffer.alloc(32, 7)))

const MANAGED: Record<string, string> = {
  CONTROL_PLANE_PUBLIC_KEYS: rawPublicKey(cp.privateKey).toString("base64url"),
  TENANT_ID,
  TENANT_SIGNING_KEY: TEST_ONLY_TENANT_SEED.toString("base64url"),
  CONTROL_PLANE_URL: "http://cp.internal:9100",
}

const RECORD: BillingRecord = {
  id: "chg_01",
  period: "monthly",
  period_start: "2026-11-01",
  period_end: "2026-12-01",
  due_on: "2026-11-01",
  amount: 149_000,
  currency: "TRY",
  status: "paid",
  paid_on: "2026-11-03",
  invoice_number: null,
  invoice_url: null,
}

type Answer = (nonce: string) => { status: number; body: unknown }

/** The control plane as the shop meets it: the request checked, an answer built for its nonce. */
function controlPlane(answer: Answer) {
  const calls: string[] = []
  const fetch = async (url: string, init: RequestInit) => {
    calls.push(url)
    const headers = init.headers as Record<string, string>
    const checked = await verifySignedRequest(
      { method: "GET", path: BILLING_PATH, headers, body: "" },
      {
        publicKey: (kid, tenant) =>
          kid === shop.kid && tenant === TENANT_ID ? shop.privateKey : undefined,
        nonces: new MemoryNonceStore(),
      }
    )
    expect(checked.ok).toBe(true)
    const { status, body } = answer(headers["x-qt-nonce"] ?? "")
    return new Response(JSON.stringify(body), { status })
  }
  return { calls, fetch }
}

const signedFor =
  (history: BillingHistory, signer = cp, bindNonce?: string): Answer =>
  (nonce) => ({
    status: 200,
    body: {
      history,
      binding: signDocument(
        BILLING_HISTORY_PURPOSE,
        billingHistoryBinding(bindNonce ?? nonce, history),
        signer
      ),
    },
  })

describe("readPaymentHistory (adr/0061 Ek C20)", () => {
  const saved: Record<string, string | undefined> = {}
  beforeEach(() => {
    forgetPaymentHistory()
    for (const [name, value] of Object.entries(MANAGED)) {
      saved[name] = process.env[name]
      process.env[name] = value
    }
  })
  afterEach(() => {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) {
        Reflect.deleteProperty(process.env, name)
      } else {
        process.env[name] = value
      }
    }
  })

  it("shows the shop's records when the answer is signed for this request", async () => {
    const { calls, fetch } = controlPlane(signedFor({ tenant_id: TENANT_ID, records: [RECORD] }))

    expect(await readPaymentHistory({ fetch })).toEqual({ state: "ok", records: [RECORD] })
    expect(calls).toEqual([`http://cp.internal:9100${BILLING_PATH}`])
  })

  it.each([
    ["another shop's history", signedFor({ tenant_id: "ten_other", records: [RECORD] })],
    ["a key it does not trust", signedFor({ tenant_id: TENANT_ID, records: [] }, stranger)],
    ["an answer for another nonce", signedFor({ tenant_id: TENANT_ID, records: [] }, cp, "old")],
    [
      "an unknown field",
      (nonce: string) => {
        const good = signedFor({ tenant_id: TENANT_ID, records: [] })(nonce)
        return { status: 200, body: { ...(good.body as object), extra: 1 } }
      },
    ],
    [
      "a record with an http invoice link",
      signedFor({
        tenant_id: TENANT_ID,
        records: [{ ...RECORD, invoice_url: "http://e.example/f.pdf" }],
      }),
    ],
    ["an older control plane's 404", () => ({ status: 404, body: {} })],
  ])("shows nothing for %s", async (_case, answer) => {
    const { fetch } = controlPlane(answer)
    expect(await readPaymentHistory({ fetch })).toEqual({ state: "unavailable", records: [] })
  })

  it("is unavailable when the control plane cannot be reached, and never throws", async () => {
    const fetch = () => Promise.reject(new Error("ECONNREFUSED"))
    expect(await readPaymentHistory({ fetch })).toEqual({ state: "unavailable", records: [] })
  })

  it("asks nothing without a control plane", async () => {
    Reflect.deleteProperty(process.env, "CONTROL_PLANE_PUBLIC_KEYS")
    const fetch = jest.fn()
    expect(await readPaymentHistory({ fetch })).toEqual({ state: "unmanaged", records: [] })
    expect(fetch).not.toHaveBeenCalled()
  })

  it("keeps an answer a minute and asks once for callers at the same time", async () => {
    const { calls, fetch } = controlPlane(signedFor({ tenant_id: TENANT_ID, records: [RECORD] }))
    const now = Date.parse("2026-11-23T09:00:00Z")

    const [first, second] = await Promise.all([
      readPaymentHistory({ fetch, now }),
      readPaymentHistory({ fetch, now }),
    ])
    await readPaymentHistory({ fetch, now: now + HISTORY_CACHE_MS - 1 })
    expect(calls).toHaveLength(1)
    expect(second).toEqual(first)

    await readPaymentHistory({ fetch, now: now + HISTORY_CACHE_MS })
    expect(calls).toHaveLength(2)
  })
})
