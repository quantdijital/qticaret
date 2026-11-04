import { createServer } from "node:http"
import type { AddressInfo, Socket } from "node:net"
import { fakeTurkiyeApiDataset } from "./dataset"
import type { FakeTurkiyeApiDataset } from "./dataset"

/**
 * A stand-in for TürkiyeAPI v2 (adr/0008 Ek 2026-11-04), as the import
 * reads it: `GET /v2/meta`, the dataset files `GET /v2/datasets/<name>.json`
 * (a bare array) and the paged lists `GET /v2/<name>?limit&offset` (the
 * `{ data, meta }` envelope). Its dataset is the test's to change; the
 * counts in `/meta` follow it unless a test sets them. Tests point
 * TURKIYEAPI_BASE_URL at `url` (the root with `/v2`).
 */

const COLLECTIONS = [
  "provinces",
  "districts",
  "municipalities",
  "neighborhoods",
  "villages",
] as const
type Collection = (typeof COLLECTIONS)[number]

export interface FakeTurkiyeApi {
  /** The API root, `/v2` included. */
  url: string
  dataset: FakeTurkiyeApiDataset
  datasetVersion: string
  lastUpdated: string
  /** `/meta`'s counts instead of the dataset's (a dataset that came short). */
  counts: Partial<Record<Collection, number>> | null
  /** The dataset files answer 500: the import pages through the lists instead. */
  failFiles: boolean
  /** Every request answers 503: the service is down. */
  down: boolean
  /** Paths asked, in order (`/v2/meta`, `/v2/datasets/provinces.json`…). */
  requests: string[]
  close: () => Promise<void>
}

const isCollection = (value: string): value is Collection =>
  (COLLECTIONS as readonly string[]).includes(value)

const error = (code: string, status: number) => ({
  error: { code, message: code.toLowerCase(), status },
})

export async function startFakeTurkiyeApi(): Promise<FakeTurkiyeApi> {
  const sockets = new Set<Socket>()

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://fake")
    fake.requests.push(url.pathname)
    const json = (status: number, answer: unknown) => {
      res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(answer))
    }
    if (fake.down) {
      json(503, error("SERVICE_UNAVAILABLE", 503))
      return
    }
    if (req.method !== "GET") {
      json(404, error("NOT_FOUND", 404))
      return
    }
    const version = { datasetVersion: fake.datasetVersion, lastUpdated: fake.lastUpdated }
    if (url.pathname === "/v2/meta") {
      const counts = Object.fromEntries(
        COLLECTIONS.map((name) => [name, fake.counts?.[name] ?? fake.dataset[name].length])
      )
      json(200, { data: { apiVersion: "2.0.3", ...version, sources: [], counts } })
      return
    }
    const file = /^\/v2\/datasets\/(\w+)\.json$/.exec(url.pathname)?.[1] ?? ""
    if (isCollection(file)) {
      if (fake.failFiles) {
        json(500, error("INTERNAL_SERVER_ERROR", 500))
        return
      }
      json(200, fake.dataset[file])
      return
    }
    const list = /^\/v2\/(\w+)$/.exec(url.pathname)?.[1] ?? ""
    if (isCollection(list)) {
      const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 1000)
      const offset = Number(url.searchParams.get("offset") ?? 0)
      const records = fake.dataset[list]
      const data = records.slice(offset, offset + limit)
      json(200, {
        data,
        meta: { count: data.length, total: records.length, limit, offset, ...version },
      })
      return
    }
    json(404, error("NOT_FOUND", 404))
  })
  server.on("connection", (socket) => {
    sockets.add(socket)
    socket.on("close", () => sockets.delete(socket))
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const port = (server.address() as AddressInfo).port

  const fake: FakeTurkiyeApi = {
    url: `http://127.0.0.1:${String(port)}/v2`,
    dataset: fakeTurkiyeApiDataset(),
    datasetVersion: "2025",
    lastUpdated: "2026-05-21",
    counts: null,
    failFiles: false,
    down: false,
    requests: [],
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
  return fake
}
