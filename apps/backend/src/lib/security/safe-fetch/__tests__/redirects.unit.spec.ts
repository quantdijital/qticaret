import {
  LOOPBACK,
  PRIVATE,
  failureOf,
  fetchAsPublic,
  onPort,
  publicUrl,
  resolveTo,
} from "./helpers"
import { startServer } from "./test-server"
import type { TestServer } from "./test-server"

const servers: TestServer[] = []
const serve = async (handler: Parameters<typeof startServer>[0]): Promise<TestServer> => {
  const server = await startServer(handler)
  servers.push(server)
  return server
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()))
})

const redirectingTo = (location: string, status = 302) =>
  serve((_req, res) => {
    res.writeHead(status, { location }).end()
  })

describe("safeFetch redirects", () => {
  it("follows a same-origin redirect by default, keeping credentials", async () => {
    const server = await serve((req, res) => {
      if (req.url === "/start") {
        res.writeHead(301, { location: "/next" }).end()
      } else {
        res.end("landed")
      }
    })

    const response = await fetchAsPublic()(
      publicUrl(server, "/start"),
      onPort(server, { headers: { Authorization: "Bearer secret" } })
    )

    expect(response.body.toString()).toBe("landed")
    expect(response.url).toBe(publicUrl(server, "/next"))
    expect(server.received[1]?.headers.authorization).toBe("Bearer secret")
  })

  it("refuses another origin by default", async () => {
    const other = await serve((_req, res) => res.end())
    const server = await redirectingTo(publicUrl(other))

    const reason = await failureOf(
      fetchAsPublic()(publicUrl(server), { allowedPorts: [server.port, other.port] })
    )

    expect(reason).toBe("redirect_not_allowed")
    expect(other.received).toHaveLength(0)
  })

  it("refuses every redirect in error mode", async () => {
    const server = await redirectingTo("/next")

    expect(
      await failureOf(fetchAsPublic()(publicUrl(server), onPort(server, { redirect: "error" })))
    ).toBe("redirect_not_allowed")
  })

  it("carries only harmless headers to another origin in follow mode", async () => {
    const other = await serve((_req, res) => res.end())
    const server = await redirectingTo(publicUrl(other, "/landing"))

    await fetchAsPublic()(publicUrl(server), {
      allowedPorts: [server.port, other.port],
      redirect: "follow",
      headers: { Authorization: "Bearer secret", "X-Api-Key": "k-1", Accept: "application/json" },
    })

    expect(other.received[0]?.headers).not.toHaveProperty("authorization")
    expect(other.received[0]?.headers).not.toHaveProperty("x-api-key")
    expect(other.received[0]?.headers.accept).toBe("application/json")
  })

  it("checks the address again after a redirect", async () => {
    const server = await redirectingTo("http://internal.test/")
    const resolve = resolveTo([LOOPBACK], [PRIVATE])

    const reason = await failureOf(
      fetchAsPublic(resolve)(publicUrl(server), {
        allowedPorts: [server.port, 80],
        redirect: "follow",
      })
    )

    expect(reason).toBe("address_not_allowed")
    expect(resolve.calls).toEqual(["public.test", "internal.test"])
  })

  it.each([
    ["the metadata address", "http://169.254.169.254/latest/meta-data/", "address_not_allowed"],
    ["a protocol-relative internal host", "//10.0.0.1/", "address_not_allowed"],
    ["a file URL", "file:///etc/passwd", "protocol_not_allowed"],
    ["a port outside the allow list", "http://public.test:6379/", "port_not_allowed"],
  ])("refuses a redirect to %s", async (_label, location, reason) => {
    const server = await redirectingTo(location)

    const failure = await failureOf(
      fetchAsPublic()(publicUrl(server), { allowedPorts: [server.port, 80], redirect: "follow" })
    )

    expect(failure).toBe(reason)
  })

  it("stops after the redirect limit", async () => {
    const server = await redirectingTo("/again")

    const reason = await failureOf(
      fetchAsPublic()(publicUrl(server), onPort(server, { maxRedirects: 2 }))
    )

    expect(reason).toBe("too_many_redirects")
    expect(server.received).toHaveLength(3)
  })

  it("follows no redirect with a limit of zero", async () => {
    const server = await redirectingTo("/again")

    expect(
      await failureOf(fetchAsPublic()(publicUrl(server), onPort(server, { maxRedirects: 0 })))
    ).toBe("too_many_redirects")
    expect(server.received).toHaveLength(1)
  })

  it.each([301, 302, 303])("turns a POST into a body-less GET on %i", async (status) => {
    const server = await serve((req, res) => {
      if (req.url === "/submit") {
        res.writeHead(status, { location: "/done" }).end()
      } else {
        res.end()
      }
    })

    await fetchAsPublic()(
      publicUrl(server, "/submit"),
      onPort(server, {
        method: "POST",
        body: '{"a":1}',
        headers: { "Content-Type": "application/json" },
      })
    )

    expect(server.received[1]).toMatchObject({ method: "GET", path: "/done", body: "" })
    expect(server.received[1]?.headers).not.toHaveProperty("content-type")
  })

  it("keeps the method and body on a same-origin 307", async () => {
    const server = await serve((req, res) => {
      if (req.url === "/submit") {
        res.writeHead(307, { location: "/retry" }).end()
      } else {
        res.end()
      }
    })

    await fetchAsPublic()(
      publicUrl(server, "/submit"),
      onPort(server, { method: "POST", body: "payload" })
    )

    expect(server.received[1]).toMatchObject({ method: "POST", path: "/retry", body: "payload" })
  })
})
