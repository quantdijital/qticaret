import { createServer } from "node:http"
import type { Server } from "node:http"
import type { AddressInfo } from "node:net"
import { isBlockedAddress } from "@qticaret/server-kit"
import { pinPolicy, probePinned } from "../pinned-probe"
import type { PinPolicy } from "../pinned-probe"

describe("the storefront probe's pinned connection (Ek C13 review L2)", () => {
  let server: Server
  let port: number
  const seen: { host: string | undefined; url: string | undefined }[] = []
  let status = 200

  beforeAll(async () => {
    server = createServer((req, res) => {
      seen.push({ host: req.headers.host, url: req.url })
      res.writeHead(status, status === 301 ? { location: "http://169.254.169.254/" } : {}).end()
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    port = (server.address() as AddressInfo).port
  })
  beforeEach(() => {
    seen.length = 0
    status = 200
  })
  afterAll(() => {
    server.closeAllConnections()
    server.close()
  })

  // A name that resolves to this machine, as a rebinding attacker would make it
  const toLoopback = (allowed: (address: string) => boolean): PinPolicy => ({
    resolve: () => Promise.resolve([{ address: "127.0.0.1", family: 4 }]),
    isAddressAllowed: allowed,
  })

  it("connects to the checked address under the name asked for", async () => {
    const result = await probePinned(
      `http://shop.example:${String(port)}/`,
      "storefront",
      toLoopback(() => true)
    )
    expect(result).toMatchObject({ ok: true, status_code: 200, error: null })
    expect(seen).toEqual([{ host: `shop.example:${String(port)}`, url: "/" }])
  })

  it("refuses, before connecting, a name or address inside once deployed", async () => {
    const deployed = pinPolicy(false)
    const publicRule = (address: string) => !isBlockedAddress(address)
    for (const [url, policy] of [
      [`http://shop.example:${String(port)}/`, toLoopback(publicRule)],
      [`http://127.0.0.1:${String(port)}/`, deployed],
      ["http://169.254.169.254/", deployed],
      ["http://10.0.0.5/", deployed],
      ["http://100.64.0.1/", deployed],
      ["http://[::1]/", deployed],
    ] as const) {
      expect(await probePinned(url, "storefront", policy, 500)).toMatchObject({
        ok: false,
        error: "health.address_not_allowed",
      })
    }
    // One inside answer among public ones is enough
    const mixed: PinPolicy = {
      resolve: () =>
        Promise.resolve([
          { address: "93.184.216.34", family: 4 },
          { address: "10.0.0.5", family: 4 },
        ]),
      isAddressAllowed: publicRule,
    }
    expect(await probePinned("https://shop.example/", "storefront", mixed, 500)).toMatchObject({
      error: "health.address_not_allowed",
    })
    expect(seen).toEqual([])
  })

  it("on this machine takes loopback only, localhost answered without DNS", async () => {
    const local = pinPolicy(true)
    expect(
      await probePinned(`http://localhost:${String(port)}/`, "storefront", local)
    ).toMatchObject({ ok: true })
    expect(await probePinned("http://10.0.0.5:8000/", "storefront", local, 500)).toMatchObject({
      error: "health.address_not_allowed",
    })
  })

  it("names a failed lookup, and follows no redirect", async () => {
    const broken: PinPolicy = {
      resolve: () => Promise.reject(new Error("ENOTFOUND")),
      isAddressAllowed: () => true,
    }
    expect(await probePinned("https://nowhere.example/", "storefront", broken)).toMatchObject({
      error: "health.dns_failed",
    })
    status = 301
    expect(
      await probePinned(`http://localhost:${String(port)}/`, "storefront", pinPolicy(true))
    ).toMatchObject({ ok: false, status_code: 301, error: "health.redirect" })
    expect(seen).toHaveLength(1)
  })
})
