import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createSecureContext, createServer } from "node:tls"
import type { Server } from "node:tls"
import { failureOf, fetchAsPublic, resolveTo, LOOPBACK } from "./helpers"

// A throwaway self-signed certificate made for this run: it is never trusted,
// which is the point, and nothing private is committed
let directory: string
let server: Server
let port: number
const serverNames: string[] = []

beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), "safe-fetch-tls-"))
  const key = join(directory, "key.pem")
  const cert = join(directory, "cert.pem")
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-days",
      "1",
      "-subj",
      "/CN=public.test",
    ].concat(["-keyout", key, "-out", cert]),
    { stdio: "ignore" }
  )
  const context = createSecureContext({ key: readFileSync(key), cert: readFileSync(cert) })
  server = createServer({
    SNICallback: (name, callback) => {
      serverNames.push(name)
      callback(null, context)
    },
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
  rmSync(directory, { recursive: true, force: true })
})

describe("safeFetch over HTTPS", () => {
  it("connects to the pinned address, sends the hostname for SNI and verifies the certificate", async () => {
    const resolve = resolveTo([LOOPBACK])

    const reason = await failureOf(
      fetchAsPublic(resolve)(`https://public.test:${String(port)}/`, { allowedPorts: [port] })
    )

    // The socket reached the local server without anyone resolving the fake
    // name a second time, the TLS hello named the host, and the untrusted
    // certificate ended the exchange
    expect(resolve.calls).toEqual(["public.test"])
    expect(serverNames).toEqual(["public.test"])
    expect(reason).toBe("request_failed")
  })
})
