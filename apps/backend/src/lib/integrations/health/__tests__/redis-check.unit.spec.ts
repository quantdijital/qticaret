import { createServer } from "node:net"
import type { AddressInfo, Server } from "node:net"
import { redisHealthCheck } from "../redis-check"

const PASSWORD = "test-password"

type Behaviour = "pong" | "silent" | "close"

let server: Server
let port: number
let behaviour: Behaviour
let received: string

beforeAll(async () => {
  // Enough of RESP for AUTH and PING
  server = createServer((socket) => {
    socket.on("data", (chunk: Buffer) => {
      received += chunk.toString("utf8")
      if (behaviour === "silent") {
        return
      }
      if (behaviour === "close") {
        socket.destroy()
        return
      }
      if (received.includes("AUTH")) {
        socket.write(
          received.includes(PASSWORD) ? "+OK\r\n" : "-WRONGPASS invalid username-password pair\r\n"
        )
      }
      if (
        received.includes("PING") &&
        (!received.includes("AUTH") || received.includes(PASSWORD))
      ) {
        socket.write("+PONG\r\n")
      }
    })
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  port = (server.address() as AddressInfo).port
})

afterAll(async () => {
  await new Promise<void>((resolve) =>
    server.close(() => {
      resolve()
    })
  )
})

beforeEach(() => {
  behaviour = "pong"
  received = ""
})

const run = (url: string | undefined, timeoutMs = 1000) =>
  redisHealthCheck(url).check(AbortSignal.timeout(timeoutMs))

describe("redisHealthCheck", () => {
  it("is not configured without REDIS_URL", async () => {
    expect(await run(undefined)).toEqual({ status: "not_configured" })
  })

  it("is ok when PING answers PONG", async () => {
    expect(await run(`redis://127.0.0.1:${String(port)}`)).toEqual({ status: "ok" })
    expect(received).toContain("PING")
    expect(received).not.toContain("AUTH")
  })

  it("authenticates first when the URL has a password", async () => {
    expect(await run(`redis://:${PASSWORD}@127.0.0.1:${String(port)}`)).toEqual({ status: "ok" })
    expect(received.indexOf("AUTH")).toBeLessThan(received.indexOf("PING"))
  })

  it("reports a refused password as auth_failed, without echoing it", async () => {
    const outcome = await run(`redis://:wrong-secret@127.0.0.1:${String(port)}`)

    expect(outcome).toEqual({ status: "down", reason: "auth_failed" })
    expect(JSON.stringify(outcome)).not.toContain("wrong-secret")
  })

  it("reports a server that does not answer as a timeout", async () => {
    behaviour = "silent"

    expect(await run(`redis://127.0.0.1:${String(port)}`, 200)).toEqual({
      status: "down",
      reason: "timeout",
    })
  })

  it("reports a closed connection or a refused port as connection_failed", async () => {
    behaviour = "close"

    expect(await run(`redis://127.0.0.1:${String(port)}`)).toEqual({
      status: "down",
      reason: "connection_failed",
    })
    expect(await run("redis://127.0.0.1:1")).toEqual({
      status: "down",
      reason: "connection_failed",
    })
  })
})
