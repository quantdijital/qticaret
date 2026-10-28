import { createHmac, randomBytes, randomUUID } from "node:crypto"
import { createServer } from "node:http"
import type { AddressInfo, Socket } from "node:net"

/**
 * Stand-ins for where e-mail leaves the platform (adr/0036): Mailpit's
 * HTTP send endpoint (`POST /api/v1/send`, v1.31.4) and Resend's
 * (`POST /emails`, Bearer key, `Idempotency-Key`). Both keep what they
 * were sent, so a test reads the message a shopper would get.
 */

export interface FakeMailMessage {
  id: string
  from: string
  to: string[]
  replyTo: string[]
  subject: string
  html: string
  text: string
  /** Our template's name, as the sender marked it. */
  template: string
}

export interface FakeMail {
  url: string
  /** Resend's key the server takes; random each run. */
  apiKey: string
  messages: FakeMailMessage[]
  /** The next send answers with this HTTP status (an outage, a refusal). */
  failNext: (status: number) => void
  close: () => Promise<void>
}

type Json = Record<string, unknown>

const addressOf = (value: unknown): string => {
  if (typeof value === "string") {
    return value
  }
  const email = (value as { Email?: unknown } | null)?.Email
  return typeof email === "string" ? email : ""
}

const textOf = (value: unknown): string => (typeof value === "string" ? value : "")

const listOf = (value: unknown): string[] =>
  (Array.isArray(value) ? value : value === undefined ? [] : [value]).map(addressOf)

export async function startFakeMail(options: { port?: number } = {}): Promise<FakeMail> {
  const apiKey = `re_sahte_${randomBytes(12).toString("hex")}`
  const messages: FakeMailMessage[] = []
  const byKey = new Map<string, string>()
  const failures: number[] = []
  const sockets = new Set<Socket>()

  const server = createServer((req, res) => {
    let raw = ""
    req.on("data", (chunk: Buffer) => (raw += chunk.toString()))
    req.on("end", () => {
      const reply = (status: number, body: Json) => {
        res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body))
      }
      const failure = failures.shift()
      if (failure !== undefined) {
        reply(failure, { name: "internal_server_error", message: "sahte hata" })
        return
      }
      let body: Json
      try {
        body = JSON.parse(raw) as Json
      } catch {
        reply(400, { name: "validation_error", message: "invalid json" })
        return
      }
      if (req.method === "POST" && req.url === "/api/v1/send") {
        const headers = (body["Headers"] ?? {}) as Record<string, string>
        const id = randomUUID()
        messages.push({
          id,
          from: addressOf(body["From"]),
          to: listOf(body["To"]),
          replyTo: listOf(body["ReplyTo"]),
          subject: textOf(body["Subject"]),
          html: textOf(body["HTML"]),
          text: textOf(body["Text"]),
          template: headers["X-Qt-Template"] ?? "",
        })
        reply(200, { ID: id })
        return
      }
      if (req.method === "POST" && req.url === "/emails") {
        if (req.headers.authorization !== `Bearer ${apiKey}`) {
          reply(401, { name: "missing_api_key", message: "API key is invalid" })
          return
        }
        const key = req.headers["idempotency-key"]
        const known = typeof key === "string" ? byKey.get(key) : undefined
        if (known) {
          reply(200, { id: known })
          return
        }
        const id = randomUUID()
        const tags = (body["tags"] ?? []) as { name: string; value: string }[]
        messages.push({
          id,
          from: textOf(body["from"]),
          to: listOf(body["to"]),
          replyTo: listOf(body["reply_to"]),
          subject: textOf(body["subject"]),
          html: textOf(body["html"]),
          text: textOf(body["text"]),
          template: tags.find((tag) => tag.name === "template")?.value ?? "",
        })
        if (typeof key === "string") {
          byKey.set(key, id)
        }
        reply(200, { id })
        return
      }
      reply(404, { name: "not_found", message: "not found" })
    })
  })
  server.on("connection", (socket) => {
    sockets.add(socket)
    socket.on("close", () => sockets.delete(socket))
  })
  await new Promise<void>((resolve) => server.listen(options.port ?? 0, "127.0.0.1", resolve))
  const address = server.address() as AddressInfo

  return {
    url: `http://127.0.0.1:${String(address.port)}`,
    apiKey,
    messages,
    failNext: (status) => {
      failures.push(status)
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

/** A Resend signing secret for one run: `whsec_` and random base64, never a real one. */
export const fakeResendSecret = (): string => `whsec_${randomBytes(24).toString("base64")}`

/** Signs a report as Resend does (Svix): HMAC-SHA256 over `id.timestamp.body`. */
export function signResendReport(
  secret: string,
  body: string,
  options: { id?: string; at?: Date } = {}
): Record<string, string> {
  const id = options.id ?? `msg_${randomBytes(8).toString("hex")}`
  const timestamp = String(Math.floor((options.at ?? new Date()).getTime() / 1000))
  const key = Buffer.from(secret.slice("whsec_".length), "base64")
  const signature = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64")
  return {
    "svix-id": id,
    "svix-timestamp": timestamp,
    "svix-signature": `v1,${signature}`,
    "content-type": "application/json",
  }
}
