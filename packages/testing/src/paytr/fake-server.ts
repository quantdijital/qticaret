import { createServer } from "node:http"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { AddressInfo, Socket } from "node:net"
import { FORM_PATH, answerPaymentForm, totalWithSurcharge } from "./checkout-page"
import type { PaymentForm } from "./checkout-page"
import { paytrNotification, sendPaytrNotification } from "./notification"
import { createFakePaytrHandlers } from "./handlers"
import type { FakePayment, FakeRefundEntry, Fields, Reply } from "./handlers"
import type { PaytrAccount } from "./signing"

/**
 * A local stand-in for www.paytr.com (docs/07: tests never call the real
 * provider). It answers the iFrame token, status query, refund,
 * installment rate and transaction statement (`statement.ts`, F11.3)
 * APIs as dev.paytr.com describes them, checks every
 * signature with the account, and keeps the payments it has seen. Strict
 * where PayTR is lenient: a request carrying the key or the salt is refused.
 * It also serves a clickable payment form (`checkout-page.ts`, adr/0028).
 */

export type { FakePayment, FakeRefundEntry } from "./handlers"

const SECRET_FIELDS = ["merchant_key", "merchant_salt"]

/** An answer queued for the next request to a path: a body, a stall, or a dropped connection. */
export type FakeAnswer = { status?: number; body: unknown } | { hang: true } | { drop: true }

export interface FakePaytr {
  url: string
  account: PaytrAccount
  payments: Map<string, FakePayment>
  /** Every refund with its time, as the statement lists them. */
  refundLog: FakeRefundEntry[]
  requests: { path: string; fields: Record<string, string> }[]
  queue: (path: string, answer: FakeAnswer) => void
  /** Completes a payment as the iFrame would; returns the notification PayTR sends. */
  pay: (
    merchantOid: string,
    outcome?: { status?: "success" | "failed"; installments?: number; totalAmount?: number }
  ) => Record<string, string>
  /**
   * Pays and posts the notification to the shop's URL, as PayTR does; the
   * payment counts as notified once the shop answers exactly "OK".
   */
  notify: (
    url: string,
    merchantOid: string,
    outcome?: { status?: "success" | "failed"; installments?: number; totalAmount?: number }
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
}

/** Starts the fake on a local port. */
export async function startFakePaytr(
  account: PaytrAccount,
  options: FakePaytrOptions = {}
): Promise<FakePaytr> {
  const payments = new Map<string, FakePayment>()
  const requests: FakePaytr["requests"] = []
  const queued = new Map<string, FakeAnswer[]>()
  const sockets = new Set<Socket>()
  const refundLog: FakeRefundEntry[] = []
  const handlers = createFakePaytrHandlers(account, payments, refundLog)

  const server = createServer((req, res) => {
    void (async () => {
      const path = new URL(req.url ?? "/", "http://fake").pathname
      const fields = await readForm(req)
      requests.push({ path, fields })
      const formToken = FORM_PATH.exec(path)?.[1]
      if (formToken) {
        await answerPaymentForm(res, req.method, formToken, fields, form)
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
      if (payment.status === "success") {
        payment.paidAt = Date.now()
      }
      return paytrNotification(account, {
        merchantOid,
        status: payment.status === "failed" ? "failed" : "success",
        paymentAmount: payment.paymentAmount,
        totalAmount: payment.totalAmount,
        testMode: payment.testMode,
        currency: payment.currency,
        ...(payment.status === "failed" ? { failedReasonCode: "2" } : {}),
      })
    },
    notify: async (url, merchantOid, outcome) => {
      const answer = await sendPaytrNotification(url, fake.pay(merchantOid, outcome))
      const payment = payments.get(merchantOid)
      if (payment && answer.body === "OK") {
        payment.notified = true
      }
      return answer
    },
    close: async () => {
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
    find: (token) => [...payments.values()].find((payment) => payment.formToken === token),
    complete: async (payment, outcome, installments) => {
      const notification = fake.pay(payment.merchantOid, {
        status: outcome === "failed" ? "failed" : "success",
        installments,
        totalAmount: totalWithSurcharge(payment.paymentAmount, installments),
      })
      if (outcome === "silent" || !options.notifyUrl) {
        return
      }
      // A shop that is down is PayTR's retry problem; the form still sends the shopper back
      const answer = await sendPaytrNotification(options.notifyUrl, notification).catch(() => null)
      payment.notified = answer?.body === "OK"
    },
  }
  return fake
}
