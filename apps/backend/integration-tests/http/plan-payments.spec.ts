import { createServer } from "node:http"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { MemoryNonceStore, signDocument, verifySignedRequest } from "@qticaret/server-kit"
import type { Ed25519Signer } from "@qticaret/server-kit"
import { BILLING_HISTORY_PURPOSE, billingHistoryBinding } from "@qticaret/types/control-plane"
import type { BillingHistory, BillingRecord } from "@qticaret/types/control-plane"
import { TENANT_ID } from "@qticaret/types/control-plane/testing"
import { BILLING_PATH } from "../../src/lib/control-plane/billing-history"
import type { PaymentHistory } from "../../src/lib/control-plane/billing-history"
import { createAdminUser } from "../helpers/admin"
import { MANAGED_ENV, cp, listen, managedForThisFile, shop } from "../helpers/control-plane"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(240 * 1000)

const PAID: BillingRecord = {
  id: "chg_01JPAID",
  period: "monthly",
  period_start: "2026-10-01",
  period_end: "2026-11-01",
  due_on: "2026-10-01",
  amount: 149_000,
  currency: "TRY",
  status: "paid",
  paid_on: "2026-10-02",
  invoice_number: "QTC2026000001",
  invoice_url: "https://fatura.example.com/QTC2026000001.pdf",
}

const OPEN: BillingRecord = {
  ...PAID,
  id: "chg_01JOPEN",
  period_start: "2026-11-01",
  period_end: "2026-12-01",
  due_on: "2026-11-01",
  status: "open",
  paid_on: null,
  invoice_number: null,
  invoice_url: null,
}

/**
 * A stand-in control plane for `GET /tenant-api/v1/billing`: checks the
 * shop's signature, then answers `history` bound to the request's nonce
 * with `signer`. `calls` counts the requests that reached it.
 */
function fakeBilling(history: BillingHistory, signer: Ed25519Signer = cp) {
  const nonces = new MemoryNonceStore()
  const calls: string[] = []
  const server = createServer((req, res) => {
    void verifySignedRequest(
      { method: req.method ?? "", path: req.url ?? "", headers: req.headers, body: "" },
      {
        publicKey: (kid, tenantId) =>
          kid === shop.kid && tenantId === TENANT_ID ? shop.privateKey : undefined,
        nonces,
      }
    ).then((verified) => {
      calls.push(verified.ok ? `signed ${req.url ?? ""}` : verified.code)
      if (!verified.ok) {
        res.writeHead(401, { "content-type": "application/json" })
        res.end(JSON.stringify({ message: verified.code }))
        return
      }
      const binding = signDocument(
        BILLING_HISTORY_PURPOSE,
        billingHistoryBinding(verified.nonce, history),
        signer
      )
      res.writeHead(200, { "content-type": "application/json" })
      res.end(JSON.stringify({ history, binding }))
    })
  })
  return { server, calls }
}

/**
 * adr/0061 Ek C20 on the shop's side: Settings > Abonelik's payments come
 * from the control plane, signed for this shop and this request, through
 * `GET /admin/plan/payments` (owner and admin). An answer for another shop
 * or under a key the shop does not trust shows nothing; a control plane
 * that is down leaves the page standing (`unavailable`).
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    managedForThisFile()

    const payments = async (headers: Record<string, string>) =>
      settle(http.get<{ payments: PaymentHistory }>("/admin/plan/payments", { headers }))

    /** The shop pointed at `server` for one test (a fresh address: a fresh cache). */
    async function withControlPlane<T>(
      server: ReturnType<typeof createServer>,
      run: () => Promise<T>
    ): Promise<T> {
      process.env["CONTROL_PLANE_URL"] = await listen(server)
      try {
        return await run()
      } finally {
        process.env["CONTROL_PLANE_URL"] = MANAGED_ENV.CONTROL_PLANE_URL
        server.close()
      }
    }

    it("shows the shop's payments as the control plane signs them, latest first", async () => {
      const owner = await createAdminUser(http, getContainer())
      const { server, calls } = fakeBilling({ tenant_id: TENANT_ID, records: [OPEN, PAID] })

      const answer = await withControlPlane(server, () => payments(owner.headers))

      expect(answer.status).toBe(200)
      expect(answer.headers["cache-control"]).toBe("no-store")
      expect(answer.data.payments).toEqual({ state: "ok", records: [OPEN, PAID] })
      expect(calls).toEqual([`signed ${BILLING_PATH}`])
    })

    it("shows nothing for another shop's history or a key it does not trust", async () => {
      const owner = await createAdminUser(http, getContainer())
      const other = fakeBilling({ tenant_id: "ten_other", records: [PAID] })
      const forged = fakeBilling({ tenant_id: TENANT_ID, records: [PAID] }, shop)

      const first = await withControlPlane(other.server, () => payments(owner.headers))
      const second = await withControlPlane(forged.server, () => payments(owner.headers))

      for (const answer of [first, second]) {
        expect(answer.status).toBe(200)
        expect(answer.data.payments).toEqual({ state: "unavailable", records: [] })
      }
    })

    it("stands when the control plane is down: unavailable, never an error", async () => {
      const owner = await createAdminUser(http, getContainer())

      const answer = await payments(owner.headers)

      expect(answer.status).toBe(200)
      expect(answer.data.payments).toEqual({ state: "unavailable", records: [] })
    })

    it("is the owner's and admins', as the plan is; nobody signed out", async () => {
      const readonly = await createAdminUser(http, getContainer(), "readonly")
      const admin = await createAdminUser(http, getContainer(), "admin")

      expect((await payments(readonly.headers)).status).toBe(403)
      expect((await payments(admin.headers)).status).toBe(200)
      expect((await payments({})).status).toBe(401)
    })
  },
})
