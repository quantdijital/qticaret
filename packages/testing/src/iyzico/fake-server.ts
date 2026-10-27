import { createServer } from "node:http"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { AddressInfo, Socket } from "node:net"
import { iyzicoSign, readAuthorization } from "./signing"
import type { IyzicoAccount } from "./signing"

/**
 * A local stand-in for iyzico's API (docs/07: tests never call the real
 * provider). It checks every request's IYZWSv2 signature and answers as
 * the sandbox did on 2026-10-27: an unknown API key is `1001`, a signature
 * that does not match is `1000`, failures as HTTP 200. Today it answers
 * the installment table (the connection check); the payment calls join in
 * F5 V9 and V10. Strict where iyzico is lenient: a request carrying the
 * secret key is refused.
 */

/** An answer queued for the next request to a path: a body, a stall, or a dropped connection. */
export type FakeIyzicoAnswer = { status?: number; body: unknown } | { hang: true } | { drop: true }

export interface FakeIyzico {
  url: string
  account: IyzicoAccount
  requests: { path: string; body: Record<string, unknown> }[]
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
            installmentDetails: [
              {
                price: Number(body["price"]),
                cardFamilyName: "Bonus",
                installmentPrices: [
                  {
                    installmentNumber: 1,
                    totalPrice: Number(body["price"]),
                    installmentPrice: Number(body["price"]),
                  },
                ],
              },
            ],
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

function answer(account: IyzicoAccount, req: IncomingMessage, path: string, text: string): Reply {
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
  const handler = req.method === "POST" ? HANDLERS[path] : undefined
  return handler ? handler(body) : { status: 404, body: "not found" }
}

/** Starts the fake on a local port: a free one, or `port` for a dev backend's IYZICO_BASE_URL. */
export async function startFakeIyzico(account: IyzicoAccount, port = 0): Promise<FakeIyzico> {
  const requests: FakeIyzico["requests"] = []
  const queued = new Map<string, FakeIyzicoAnswer[]>()
  const sockets = new Set<Socket>()

  const server = createServer((req, res) => {
    void (async () => {
      const path = new URL(req.url ?? "/", "http://fake").pathname
      const text = await readText(req)
      requests.push({ path, body: JSON.parse(text || "{}") as Record<string, unknown> })
      const next = queued.get(path)?.shift()
      if (next && "hang" in next) {
        return
      }
      if (next && "drop" in next) {
        req.socket.destroy()
        return
      }
      send(res, next ?? answer(account, req, path, text))
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

  return {
    url: `http://127.0.0.1:${String(address.port)}`,
    account,
    requests,
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
