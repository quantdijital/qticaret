import { createServer } from "node:http"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { AddressInfo, Socket } from "node:net"
import { loadState, saveState } from "../dev/state-file"
import type { FakeCard } from "./cards"
import { FORM_PATH, answerPaymentForm } from "./checkout-page"
import type { PaymentForm } from "./checkout-page"
import { paytrNotification, sendPaytrNotification } from "./notification"
import { createFakePaytrHandlers } from "./handlers"
import type { FakePayment, FakeRefundEntry, Fields, Reply } from "./handlers"
import { TEST_RATES } from "./rates"
import type { InstallmentRates } from "./rates"
import type { PaytrAccount } from "./signing"

/**
 * A local stand-in for www.paytr.com (docs/07: tests never call the real
 * provider). It answers the iFrame token, status query, refund,
 * installment rate and transaction statement (`statement.ts`, F11.3)
 * APIs as dev.paytr.com describes them, checks every
 * signature with the account, and keeps the payments it has seen. Strict
 * where PayTR is lenient: a request carrying the key or the salt is refused.
 * It also serves PayTR's card form and the bank's 3-D Secure step
 * (`checkout-page.ts`, adr/0028; the test cards in README.md).
 */

export type { FakePayment, FakeRefundEntry } from "./handlers"

const SECRET_FIELDS = ["merchant_key", "merchant_salt"]

/** An answer queued for the next request to a path: a body, a stall, or a dropped connection. */
export type FakeAnswer = { status?: number; body: unknown } | { hang: true } | { drop: true }

/** How a test completes a payment: by default paid in one go with a World card. */
export interface FakePayOutcome {
  status?: "success" | "failed"
  installments?: number
  totalAmount?: number
  card?: FakeCard
  /** `failed_reason_code` and `failed_reason_msg` for a refusal. */
  reason?: { code: string; message: string }
}

export interface FakePaytr {
  url: string
  account: PaytrAccount
  payments: Map<string, FakePayment>
  /** Every refund with its time, as the statement lists them. */
  refundLog: FakeRefundEntry[]
  requests: { path: string; fields: Record<string, string> }[]
  queue: (path: string, answer: FakeAnswer) => void
  /** Completes a payment as the iFrame would; returns the notification PayTR sends. */
  pay: (merchantOid: string, outcome?: FakePayOutcome) => Record<string, string>
  /**
   * Pays and posts the notification to the shop's URL, as PayTR does; the
   * payment counts as notified once the shop answers exactly "OK".
   */
  notify: (
    url: string,
    merchantOid: string,
    outcome?: FakePayOutcome
  ) => Promise<{ status: number; body: string }>
  close: () => Promise<void>
}

async function readForm(req: IncomingMessage): Promise<Fields> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(chunk as Buffer)
  }
  return Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString("utf8")))
}

const send = (res: ServerResponse, reply: Reply) => {
  res.writeHead(reply.status ?? 200, { "content-type": "application/json" })
  res.end(typeof reply.body === "string" ? reply.body : JSON.stringify(reply.body))
}

export interface FakePaytrOptions {
  /** A free port by default; a fixed one for a dev backend's PAYTR_BASE_URL. */
  port?: number
  /** Where the payment form's outcome is notified, as PayTR's panel setting is. */
  notifyUrl?: string
  /** The installment rates PayTR answers (`oranlar`); tests' narrow table by default. */
  rates?: InstallmentRates
  /** A file to keep payments and refunds in between runs (`dev/state-file.ts`); none in tests. */
  stateFile?: string
}

interface SavedState {
  payments: [string, FakePayment][]
  refundLog: FakeRefundEntry[]
}

/** Starts the fake on a local port. */
export async function startFakePaytr(
  account: PaytrAccount,
  options: FakePaytrOptions = {}
): Promise<FakePaytr> {
  const saved = loadState(options.stateFile) as SavedState | null
  const payments = new Map<string, FakePayment>(saved?.payments ?? [])
  const requests: FakePaytr["requests"] = []
  const queued = new Map<string, FakeAnswer[]>()
  const sockets = new Set<Socket>()
  const refundLog: FakeRefundEntry[] = saved?.refundLog ?? []
  const rates = options.rates ?? TEST_RATES
  const handlers = createFakePaytrHandlers(account, payments, refundLog, rates)
  const save = () => {
    saveState(options.stateFile, { payments: [...payments.entries()], refundLog })
  }

  const server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? "/", "http://fake")
      const path = url.pathname
      const fields = await readForm(req)
      requests.push({ path, fields })
      const formPath = FORM_PATH.exec(path)
      if (formPath?.[1]) {
        const request = { method: req.method, token: formPath[1], secure: Boolean(formPath[2]) }
        await answerPaymentForm(res, { ...request, query: url.search }, fields, form)
        return
      }
      const answer = queued.get(path)?.shift()
      if (answer && "hang" in answer) {
        return
      }
      if (answer && "drop" in answer) {
        req.socket.destroy()
        return
      }
      if (answer) {
        send(res, answer)
        return
      }
      if (SECRET_FIELDS.some((name) => name in fields)) {
        send(res, { status: 400, body: "the merchant key and salt never travel in a request" })
        return
      }
      const handler = req.method === "POST" ? handlers[path] : undefined
      send(res, handler ? handler(fields) : { status: 404, body: "not found" })
      save()
    })().catch(() => {
      // A malformed request (a basket that is not base64 JSON): PayTR's own 500
      send(res, { status: 500, body: "error" })
    })
  })
  server.on("connection", (socket) => {
    sockets.add(socket)
    socket.on("close", () => sockets.delete(socket))
  })
  await new Promise<void>((resolve) => server.listen(options.port ?? 0, "127.0.0.1", resolve))
  const address = server.address() as AddressInfo

  const fake: FakePaytr = {
    url: `http://127.0.0.1:${String(address.port)}`,
    account,
    payments,
    refundLog,
    requests,
    queue: (path, answer) => {
      queued.set(path, [...(queued.get(path) ?? []), answer])
    },
    pay: (merchantOid, outcome = {}) => {
      const payment = payments.get(merchantOid)
      if (!payment) {
        throw new Error(`no token was requested for ${merchantOid}`)
      }
      payment.status = outcome.status ?? "success"
      payment.installments = outcome.installments ?? 1
      payment.totalAmount = outcome.totalAmount ?? payment.paymentAmount
      if (outcome.card) {
        payment.card = outcome.card
      }
      if (payment.status === "success") {
        payment.paidAt = Date.now()
      }
      save()
      return paytrNotification(account, {
        merchantOid,
        status: payment.status === "failed" ? "failed" : "success",
        paymentAmount: payment.paymentAmount,
        totalAmount: payment.totalAmount,
        testMode: payment.testMode,
        currency: payment.currency,
        ...(payment.status === "failed"
          ? {
              failedReasonCode: outcome.reason?.code ?? "2",
              ...(outcome.reason ? { failedReasonMsg: outcome.reason.message } : {}),
            }
          : {}),
      })
    },
    notify: async (url, merchantOid, outcome) => {
      const answer = await sendPaytrNotification(url, fake.pay(merchantOid, outcome))
      const payment = payments.get(merchantOid)
      if (payment && answer.body === "OK") {
        payment.notified = true
        save()
      }
      return answer
    },
    close: async () => {
      save()
      for (const socket of sockets) {
        socket.destroy()
      }
      await new Promise<void>((resolve) =>
        server.close(() => {
          resolve()
        })
      )
    },
  }
  const form: PaymentForm = {
    rates,
    find: (token) => [...payments.values()].find((payment) => payment.formToken === token),
    save,
    complete: async (payment, completion) => {
      const notification = fake.pay(payment.merchantOid, {
        status: completion.outcome === "failed" ? "failed" : "success",
        installments: completion.installments,
        totalAmount: completion.totalAmount,
        ...(completion.card ? { card: completion.card } : {}),
        ...(completion.reason ? { reason: completion.reason } : {}),
      })
      if (completion.outcome === "silent" || !options.notifyUrl) {
        return
      }
      // A shop that is down is PayTR's retry problem; the form still sends the shopper back
      const answer = await sendPaytrNotification(options.notifyUrl, notification).catch(() => null)
      payment.notified = answer?.body === "OK"
      save()
    },
  }
  return fake
}
