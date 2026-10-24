import { createServer } from "node:http"
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from "node:http"
import type { AddressInfo } from "node:net"

export interface ReceivedRequest {
  method: string
  path: string
  headers: IncomingHttpHeaders
  body: string
}

export interface TestServer {
  port: number
  /** Requests the server has seen, in order. */
  received: ReceivedRequest[]
  close: () => Promise<void>
}

type Handler = (req: IncomingMessage, res: ServerResponse, received: ReceivedRequest) => void

/** A local HTTP server on 127.0.0.1 that records what reaches it. */
export async function startServer(handler: Handler): Promise<TestServer> {
  const received: ReceivedRequest[] = []
  const server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on("data", (chunk: Buffer) => chunks.push(chunk))
    req.on("end", () => {
      const request = {
        method: req.method ?? "",
        path: req.url ?? "",
        headers: req.headers,
        body: Buffer.concat(chunks).toString("utf8"),
      }
      received.push(request)
      handler(req, res, request)
    })
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  return {
    port: (server.address() as AddressInfo).port,
    received,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections()
        server.close(() => {
          resolve()
        })
      }),
  }
}
