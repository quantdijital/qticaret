import { createServer } from "node:http"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { AddressInfo, Socket } from "node:net"
import { matchRoute } from "../geliver/routes"
import type { Reply } from "../geliver/routes"
import { createOauth } from "./oauth"
import type { FakeParasutClient, FakeParasutUser } from "./oauth"
import { createRecords, jsonApiError } from "./records"
import type { FakeEDocument, FakeJob, FakeSalesInvoice } from "./records"

/**
 * A local stand-in for Paraşüt's API v4 (docs/07: tests never call the
 * real provider; adr/0034). OAuth at `/oauth/token`, the API under
 * `/v4/{company_id}` with a bearer token, JSON:API bodies, at most 10
 * requests in 10 seconds per token (429 past it: Paraşüt documents the
 * limit, not its answer).
 */

export type { FakeParasutClient, FakeParasutUser } from "./oauth"
export type { FakeEDocument, FakeJob, FakeSalesInvoice } from "./records"
export { OOB_REDIRECT } from "./oauth"

export type FakeParasutAnswer = Reply | { hang: true } | { drop: true }

export interface FakeParasut {
  /** The origin the backend takes as `PARASUT_BASE_URL`. */
  url: string
  companyId: string
  requests: { method: string; path: string; body: Record<string, unknown> }[]
  invoices: Map<string, FakeSalesInvoice>
  documents: Map<string, FakeEDocument>
  jobs: Map<string, FakeJob>
  /** Tax ids with an e-Fatura inbox: their buyers get an e-Fatura. */
  inboxes: Set<string>
  /** A code as the authorize page shows it, for the panel's "paste the code". */
  issueCode: () => string
  failNextJob: (errors: string[]) => void
  expireTokens: () => void
  revokeTokens: () => void
  /** Queues an answer for the next `METHOD /path` (the path after `/v4/{company}`). */
  queue: (route: string, answer: FakeParasutAnswer) => void
  close: () => Promise<void>
}

const RATE_WINDOW_MS = 10_000
const RATE_LIMIT = 10

async function readText(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks).toString("utf8")
}

function send(res: ServerResponse, reply: Reply) {
  if (reply.bytes) {
    res.writeHead(reply.status ?? 200, { "content-type": reply.bytes.type })
    res.end(reply.bytes.data)
    return
  }
  if (reply.body === null) {
    res.writeHead(reply.status ?? 204)
    res.end()
    return
  }
  res.writeHead(reply.status ?? 200, { "content-type": "application/vnd.api+json" })
  res.end(JSON.stringify(reply.body))
}

/** The token endpoint's fields, as a form or as JSON. */
function fieldsOf(req: IncomingMessage, text: string): Record<string, string> {
  if (req.headers["content-type"]?.includes("application/json")) {
    return (text ? JSON.parse(text) : {}) as Record<string, string>
  }
  return Object.fromEntries(new URLSearchParams(text))
}

/** Starts the fake on a local port: a free one, or `port` for a dev backend's PARASUT_BASE_URL. */
export async function startFakeParasut(
  client: FakeParasutClient,
  user: FakeParasutUser,
  options: { companyId?: string; port?: number; expiresIn?: number; now?: () => number } = {}
): Promise<FakeParasut> {
  const now = options.now ?? Date.now
  const companyId = options.companyId ?? "123456"
  const requests: FakeParasut["requests"] = []
  const queued = new Map<string, FakeParasutAnswer[]>()
  const hits = new Map<string, number[]>()
  const sockets = new Set<Socket>()
  const oauth = createOauth(client, user, { expiresIn: options.expiresIn ?? 7200, now })
  let origin = ""
  const records = createRecords(() => origin, now)

  const limited = (bearer: string) => {
    const recent = (hits.get(bearer) ?? []).filter((at) => at > now() - RATE_WINDOW_MS)
    recent.push(now())
    hits.set(bearer, recent)
    return recent.length > RATE_LIMIT
  }

  const api = (req: IncomingMessage, path: string, query: URLSearchParams, text: string): Reply => {
    const bearer = req.headers.authorization
    if (!oauth.allows(bearer)) {
      return jsonApiError(401, "Unauthorized")
    }
    if (limited(bearer ?? "")) {
      return jsonApiError(429, "Too Many Requests")
    }
    const route = matchRoute(records.routes, req.method ?? "GET", path)
    if (!route) {
      return jsonApiError(404, "Not Found")
    }
    if (route.params[0] !== companyId) {
      return jsonApiError(403, "Forbidden")
    }
    const body = (text ? JSON.parse(text) : {}) as Record<string, unknown>
    return route.handler({ body, query, params: route.params })
  }

  const server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? "/", "http://fake")
      const text = await readText(req)
      const pdf = /^\/pdfs\/([^/]+)\.pdf$/.exec(url.pathname)?.[1]
      if (pdf && req.method === "GET") {
        send(res, records.file(pdf))
        return
      }
      if (url.pathname === "/oauth/token" && req.method === "POST") {
        send(res, oauth.grant(fieldsOf(req, text)))
        return
      }
      if (url.pathname === "/oauth/authorize" && req.method === "GET") {
        // Paraşüt's page asks the user to allow the platform; the fake allows at once
        res.writeHead(200, { "content-type": "text/plain; charset=utf-8" })
        res.end(`Paraşüt yetki kodu (panele yapıştırın): ${oauth.issueCode()}\n`)
        return
      }
      const path = url.pathname.startsWith("/v4") ? url.pathname.slice(3) : url.pathname
      requests.push({
        method: req.method ?? "GET",
        path,
        body: (text ? JSON.parse(text) : {}) as Record<string, unknown>,
      })
      const route = path.replace(`/${companyId}`, "")
      const next = queued.get(`${req.method ?? "GET"} ${route}`)?.shift()
      if (next && "hang" in next) {
        return
      }
      if (next && "drop" in next) {
        req.socket.destroy()
        return
      }
      send(res, next ?? api(req, path, url.searchParams, text))
    })().catch(() => {
      send(res, jsonApiError(500, "Internal Server Error"))
    })
  })
  server.on("connection", (socket) => {
    sockets.add(socket)
    socket.on("close", () => sockets.delete(socket))
  })
  await new Promise<void>((resolve) => server.listen(options.port ?? 0, "127.0.0.1", resolve))
  origin = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`

  return {
    url: origin,
    companyId,
    requests,
    invoices: records.invoices,
    documents: records.documents,
    jobs: records.jobs,
    inboxes: records.inboxes,
    issueCode: oauth.issueCode,
    failNextJob: records.failNextJob,
    expireTokens: oauth.expireAll,
    revokeTokens: oauth.revokeAll,
    queue: (route, answer) => {
      queued.set(route, [...(queued.get(route) ?? []), answer])
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
