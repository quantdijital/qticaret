import { randomBytes } from "node:crypto"
import { createServer } from "node:http"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { AddressInfo, Socket } from "node:net"
import { approvalOf, consentPage } from "./consent-page"
import { oauthFlow } from "./oauth-flow"
import type { OauthClient } from "./oauth-flow"
import { answerSearchConsole } from "./search-console"
import type { SearchConsoleState } from "./search-console"

/**
 * A stand-in for Google (F10 M13): the OAuth web server flow with PKCE
 * (`/o/oauth2/v2/auth` as a page for a browser, `/token`, `/revoke`), the
 * Merchant API calls the shop makes (`accounts/v1`, `datasources/v1`,
 * `products/v1`) and Search Console and CrUX (F10.11). It keeps what it was sent,
 * and checks what Google checks: the client, the code's verifier and
 * redirect, the bearer token and its scopes, the data source.
 */

export interface FakeGoogle extends SearchConsoleState {
  url: string
  client: OauthClient
  /** The Merchant Center account the connected Google account reaches. */
  merchantId: string
  email: string
  /** Product inputs by offer id, as Merchant API holds them. */
  products: Map<string, Record<string, unknown>>
  /** Insert calls made, to tell an unchanged product was not sent again. */
  inserts: { count: number }
  dataSources: string[]
  revoked: string[]
  /**
   * Plays the consent screen: the address Google sends the browser back to.
   * `scopes`: what the shop allows (all asked for, unless a test says less).
   */
  consent: (
    authorizationUrl: string,
    answer?: "allow" | "deny",
    scopes?: string[]
  ) => Promise<string>
  close: () => Promise<void>
}

export interface FakeGoogleOptions {
  /** 0 (any free port) unless a developer's runner names one. */
  port?: number
  /** The platform's OAuth client; a random one unless fixed (a developer's `.env` keeps it). */
  client?: OauthClient
  email?: string
  /**
   * The Merchant Center account the Google account reaches; a random one
   * unless fixed (a developer's runner, so the shop can name it again).
   */
  merchantId?: string
  /** Where refresh tokens and grants are kept between runs (a developer's runner). */
  stateFile?: string
}

const randomId = (bytes = 16) => randomBytes(bytes).toString("base64url")

export async function startFakeGoogle(options: FakeGoogleOptions = {}): Promise<FakeGoogle> {
  const client = options.client ?? {
    clientId: `${randomId(8)}.apps.googleusercontent.com`,
    clientSecret: randomId(),
  }
  const merchantId =
    options.merchantId ?? String(100_000_000 + Math.floor(Math.random() * 800_000_000))
  const email = options.email ?? `magaza-${randomId(4).toLowerCase()}@example.com`
  const flow = oauthFlow(client, email, options.stateFile)
  const searchConsole: SearchConsoleState = {
    sites: [{ siteUrl: "sc-domain:magaza.example.com", permissionLevel: "siteOwner" }],
    searchRows: () => [],
    inspections: new Map(),
    inspected: [],
    sitemaps: [],
    cruxKey: randomId(),
    crux: new Map(),
  }
  const products = new Map<string, Record<string, unknown>>()
  const inserts = { count: 0 }
  const dataSources: string[] = []
  const sockets = new Set<Socket>()

  const merchantAccount = () => ({
    name: `accounts/${merchantId}`,
    accountId: merchantId,
    accountName: "Örnek Mağaza",
    languageCode: "tr",
    timeZone: { id: "Europe/Istanbul" },
  })
  const json = (res: ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body))
  }
  const apiError = (res: ServerResponse, status: number, word: string) => {
    json(res, status, { error: { code: status, status: word, message: word } })
  }
  const bodyOf = (req: IncomingMessage) =>
    new Promise<string>((resolve) => {
      let body = ""
      req.on("data", (chunk: Buffer) => (body += chunk.toString()))
      req.on("end", () => {
        resolve(body)
      })
    })

  const server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? "/", "http://fake")
      const body = await bodyOf(req)
      const bearer = (req.headers.authorization ?? "").replace(/^Bearer /, "")
      if (req.method === "GET" && url.pathname === "/o/oauth2/v2/auth") {
        res
          .writeHead(200, { "content-type": "text/html; charset=utf-8" })
          .end(consentPage(url.search.slice(1), email))
        return
      }
      if (req.method === "POST" && url.pathname === "/o/oauth2/v2/approve") {
        const { query, answer, scopes } = approvalOf(body)
        const back = flow.consent(`${url.origin}/o/oauth2/v2/auth?${query}`, answer, scopes, true)
        res.writeHead(303, { location: back }).end()
        return
      }
      if (req.method === "POST" && url.pathname === "/token") {
        const answer = flow.token(new URLSearchParams(body))
        json(res, answer.status, answer.body)
        return
      }
      if (req.method === "POST" && url.pathname === "/revoke") {
        flow.revoke(new URLSearchParams(body).get("token") ?? "")
        json(res, 200, {})
        return
      }
      if (req.method === "POST" && url.pathname === "/v1/records:queryRecord") {
        answerSearchConsole(searchConsole, req.method, url, body, "", json, res)
        return
      }
      const scope = flow.scopeOf(bearer)
      if (scope === undefined) {
        apiError(res, 401, "UNAUTHENTICATED")
        return
      }
      if (answerSearchConsole(searchConsole, req.method ?? "GET", url, body, scope, json, res)) {
        return
      }
      // Merchant API's accounts.list: the one account the Google account reaches
      if (req.method === "GET" && url.pathname === "/accounts/v1/accounts") {
        json(res, 200, { accounts: [merchantAccount()] })
        return
      }
      const account = /^\/(?:accounts|datasources|products)\/v1\/accounts\/(\d+)/.exec(
        url.pathname
      )?.[1]
      if (account !== merchantId) {
        apiError(res, 403, "PERMISSION_DENIED")
        return
      }
      if (req.method === "GET" && url.pathname === `/accounts/v1/accounts/${merchantId}`) {
        json(res, 200, merchantAccount())
        return
      }
      if (
        req.method === "POST" &&
        url.pathname === `/datasources/v1/accounts/${merchantId}/dataSources`
      ) {
        const name = `accounts/${merchantId}/dataSources/${String(1000 + dataSources.length)}`
        dataSources.push(name)
        json(res, 200, { name, input: "API" })
        return
      }
      if (!dataSources.includes(url.searchParams.get("dataSource") ?? "")) {
        apiError(res, 400, "INVALID_ARGUMENT")
        return
      }
      if (
        req.method === "POST" &&
        url.pathname === `/products/v1/accounts/${merchantId}/productInputs:insert`
      ) {
        const input = JSON.parse(body) as Record<string, unknown>
        const offerId = typeof input["offerId"] === "string" ? input["offerId"] : ""
        if (!offerId || input["contentLanguage"] !== "tr" || input["feedLabel"] !== "TR") {
          apiError(res, 400, "INVALID_ARGUMENT")
          return
        }
        inserts.count += 1
        products.set(offerId, input)
        const id = Buffer.from(`tr~TR~${offerId}`).toString("base64url")
        json(res, 200, { ...input, name: `accounts/${merchantId}/productInputs/${id}` })
        return
      }
      const removed = new RegExp(
        `^/products/v1/accounts/${merchantId}/productInputs/([\\w-]+)$`
      ).exec(url.pathname)
      if (req.method === "DELETE" && removed?.[1]) {
        const offerId = Buffer.from(removed[1], "base64url")
          .toString("utf8")
          .split("~")
          .slice(2)
          .join("~")
        if (!products.delete(offerId)) {
          apiError(res, 404, "NOT_FOUND")
          return
        }
        json(res, 200, {})
        return
      }
      apiError(res, 404, "NOT_FOUND")
    })()
  })
  server.on("connection", (socket) => {
    sockets.add(socket)
    socket.on("close", () => sockets.delete(socket))
  })
  await new Promise<void>((resolve) => server.listen(options.port ?? 0, "127.0.0.1", resolve))
  const address = server.address() as AddressInfo
  const url = `http://127.0.0.1:${String(address.port)}`

  return Object.assign(searchConsole, {
    url,
    client,
    merchantId,
    email,
    products,
    inserts,
    dataSources,
    revoked: flow.revoked,
    consent: (authorizationUrl: string, answer?: "allow" | "deny", scopes?: string[]) =>
      Promise.resolve(flow.consent(authorizationUrl, answer, scopes)),
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
  })
}
