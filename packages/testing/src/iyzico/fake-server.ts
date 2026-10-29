import { createServer } from "node:http"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { AddressInfo, Socket } from "node:net"
import { createCheckoutForms } from "./checkout-form"
import type { FakeCheckoutForm, PayOutcome } from "./checkout-form"
import { PAGE_PATH, answerPaymentPage } from "./checkout-page"
import { createRefunds } from "./refunds"
import { createStatement } from "./statement"
import { iyzicoSign, readAuthorization } from "./signing"
import type { IyzicoAccount } from "./signing"

/**
 * A local stand-in for iyzico's API (docs/07: tests never call the real
 * provider). It checks every request's IYZWSv2 signature and answers as
 * the sandbox did on 2026-10-27: an unknown API key is `1001`, a signature
 * that does not match is `1000`, failures as HTTP 200. It answers the
 * installment table (the connection check) and the Checkout Form
 * (`checkout-form.ts`, F5 V9), with a clickable payment page, refund
 * and cancel (`refunds.ts`, V10), and the daily transactions report
 * (`statement.ts`, F11.3). Strict where iyzico is lenient: a request
 * carrying the secret key is refused.
 */

export type { FakeCheckoutForm, PayOutcome } from "./checkout-form"

/** An answer queued for the next request to a path: a body, a stall, or a dropped connection. */
export type FakeIyzicoAnswer = { status?: number; body: unknown } | { hang: true } | { drop: true }

export interface FakeIyzico {
  url: string
  account: IyzicoAccount
  requests: { path: string; body: Record<string, unknown> }[]
  /** Checkout forms by token. */
  forms: Map<string, FakeCheckoutForm>
  /** Kuruş given back per item transaction; payments cancelled whole. */
  refunds: Map<string, number[]>
  cancelled: Set<string>
  /** Pays a form as its page would: the shop learns it by retrieving the form. */
  pay: (token: string, outcome?: PayOutcome) => FakeCheckoutForm
  queue: (path: string, answer: FakeIyzicoAnswer) => void
  close: () => Promise<void>
}

interface Reply {
  status?: number
  body: unknown
}

const failure = (errorCode: string, errorMessage: string, conversationId: unknown): Reply => ({
  body: {
    status: "failure",
    errorCode,
    errorMessage,
    locale: "tr",
    systemTime: Date.now(),
    conversationId,
  },
})

const HANDLERS: Readonly<Record<string, (body: Record<string, unknown>) => Reply>> = {
  "/payment/iyzipos/installment": (body) =>
    body["price"] === undefined
      ? failure("5004", "price gönderilmesi zorunludur", body["conversationId"])
      : {
          body: {
            status: "success",
            locale: "tr",
            systemTime: Date.now(),
            conversationId: body["conversationId"],
            // Two card families, totals as iyzico prices them (rates made up, fixed)
            installmentDetails: ["Bonus", "World"].map((cardFamilyName, family) => ({
              price: Number(body["price"]),
              cardFamilyName,
              installmentPrices: [1, 2, 3, 6, 9, 12].map((installmentNumber) => {
                const rate = installmentNumber === 1 ? 0 : installmentNumber * (1 + family) * 0.01
                const totalPrice = Math.round(Number(body["price"]) * (1 + rate) * 100) / 100
                return {
                  installmentNumber,
                  totalPrice,
                  installmentPrice: Math.round((totalPrice / installmentNumber) * 100) / 100,
                }
              }),
            })),
          },
        },
}

async function readText(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks).toString("utf8")
}

const send = (res: ServerResponse, reply: Reply) => {
  res.writeHead(reply.status ?? 200, { "content-type": "application/json" })
  res.end(typeof reply.body === "string" ? reply.body : JSON.stringify(reply.body))
}

function answer(
  account: IyzicoAccount,
  handlers: Readonly<Record<string, (body: Record<string, unknown>) => Reply>>,
  reads: Readonly<Record<string, (query: URLSearchParams) => Reply>>,
  req: IncomingMessage,
  path: string,
  text: string
): Reply {
  if (text.includes(account.secretKey)) {
    return { status: 400, body: "the secret key never travels in a request" }
  }
  const body = JSON.parse(text || "{}") as Record<string, unknown>
  const auth = readAuthorization(req.headers.authorization)
  if (auth?.apiKey !== account.apiKey) {
    return failure("1001", "api bilgileri bulunamadı", body["conversationId"])
  }
  const randomKey = req.headers["x-iyzi-rnd"]
  if (
    randomKey !== auth.randomKey ||
    auth.signature !== iyzicoSign(account.secretKey, auth.randomKey, path, text)
  ) {
    return failure("1000", "Geçersiz imza", body["conversationId"])
  }
  // A GET (the reports) was signed over its path alone, as checked above
  const read = req.method === "GET" ? reads[path] : undefined
  if (read) {
    return read(new URL(req.url ?? "/", "http://fake").searchParams)
  }
  const handler = req.method === "POST" ? (HANDLERS[path] ?? handlers[path]) : undefined
  return handler ? handler(body) : { status: 404, body: "not found" }
}

/** Starts the fake on a local port: a free one, or `port` for a dev backend's IYZICO_BASE_URL. */
export async function startFakeIyzico(account: IyzicoAccount, port = 0): Promise<FakeIyzico> {
  const requests: FakeIyzico["requests"] = []
  const queued = new Map<string, FakeIyzicoAnswer[]>()
  const sockets = new Set<Socket>()
  let url = ""
  const checkoutForms = createCheckoutForms(account, () => url)
  const giveBack = createRefunds(account, checkoutForms.forms)
  const handlers = { ...checkoutForms.handlers, ...giveBack.handlers }
  const reads = {
    "/v2/reporting/payment/transactions": createStatement(checkoutForms.forms, giveBack.log),
  }

  const server = createServer((req, res) => {
    void (async () => {
      const path = new URL(req.url ?? "/", "http://fake").pathname
      const text = await readText(req)
      const page = PAGE_PATH.exec(path)?.[1]
      if (page) {
        const fields = Object.fromEntries(new URLSearchParams(text))
        answerPaymentPage(res, req.method, checkoutForms.forms.get(page), fields, checkoutForms.pay)
        return
      }
      requests.push({ path, body: JSON.parse(text || "{}") as Record<string, unknown> })
      const next = queued.get(path)?.shift()
      if (next && "hang" in next) {
        return
      }
      if (next && "drop" in next) {
        req.socket.destroy()
        return
      }
      send(res, next ?? answer(account, handlers, reads, req, path, text))
    })().catch(() => {
      // A body that is not JSON: iyzico's own 500
      send(res, { status: 500, body: "error" })
    })
  })
  server.on("connection", (socket) => {
    sockets.add(socket)
    socket.on("close", () => sockets.delete(socket))
  })
  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve))
  const address = server.address() as AddressInfo
  url = `http://127.0.0.1:${String(address.port)}`

  return {
    url,
    account,
    requests,
    forms: checkoutForms.forms,
    refunds: giveBack.refunds,
    cancelled: giveBack.cancelled,
    pay: checkoutForms.pay,
    queue: (path, next) => {
      queued.set(path, [...(queued.get(path) ?? []), next])
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
}
