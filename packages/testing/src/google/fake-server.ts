import { createHash, randomBytes } from "node:crypto"
import { createServer } from "node:http"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { AddressInfo, Socket } from "node:net"

/**
 * A stand-in for Google (F10 M13): the OAuth web server flow with PKCE
 * (`/o/oauth2/v2/auth`, `/token`, `/revoke`) and the Merchant API calls the
 * shop makes (`accounts/v1`, `datasources/v1`, `products/v1`). It keeps
 * what it was sent, and checks what Google checks: the client, the code's
 * verifier and redirect, the bearer token, the data source.
 */

export interface FakeGoogle {
  url: string
  client: { clientId: string; clientSecret: string }
  /** The Merchant Center account the connected Google account reaches. */
  merchantId: string
  email: string
  /** Product inputs by offer id, as Merchant API holds them. */
  products: Map<string, Record<string, unknown>>
  /** Insert calls made, to tell an unchanged product was not sent again. */
  inserts: { count: number }
  dataSources: string[]
  revoked: string[]
  /** Plays the consent screen: the address Google sends the browser back to. */
  consent: (authorizationUrl: string, answer?: "allow" | "deny") => Promise<string>
  close: () => Promise<void>
}

const randomId = (bytes = 16) => randomBytes(bytes).toString("base64url")

export async function startFakeGoogle(): Promise<FakeGoogle> {
  const client = { clientId: `${randomId(8)}.apps.googleusercontent.com`, clientSecret: randomId() }
  const merchantId = String(100_000_000 + Math.floor(Math.random() * 800_000_000))
  const email = `magaza-${randomId(4).toLowerCase()}@example.com`
  const codes = new Map<string, { challenge: string; redirectUri: string }>()
  const refreshTokens = new Set<string>()
  const accessTokens = new Set<string>()
  const products = new Map<string, Record<string, unknown>>()
  const inserts = { count: 0 }
  const dataSources: string[] = []
  const revoked: string[] = []
  const sockets = new Set<Socket>()

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
  const idToken = () =>
    [
      Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url"),
      Buffer.from(JSON.stringify({ email, email_verified: true })).toString("base64url"),
      "",
    ].join(".")

  const server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? "/", "http://fake")
      const body = await bodyOf(req)
      const bearer = (req.headers.authorization ?? "").replace(/^Bearer /, "")
      if (req.method === "POST" && url.pathname === "/token") {
        const form = new URLSearchParams(body)
        if (
          form.get("client_id") !== client.clientId ||
          form.get("client_secret") !== client.clientSecret
        ) {
          json(res, 401, { error: "invalid_client" })
          return
        }
        if (form.get("grant_type") === "authorization_code") {
          const code = codes.get(form.get("code") ?? "")
          codes.delete(form.get("code") ?? "")
          const verifier = form.get("code_verifier") ?? ""
          const challenge = createHash("sha256").update(verifier).digest("base64url")
          if (code?.challenge !== challenge || code.redirectUri !== form.get("redirect_uri")) {
            json(res, 400, { error: "invalid_grant" })
            return
          }
          const refresh = `1//${randomId(24)}`
          const access = `ya29.${randomId(24)}`
          refreshTokens.add(refresh)
          accessTokens.add(access)
          json(res, 200, {
            access_token: access,
            expires_in: 3599,
            refresh_token: refresh,
            scope: "https://www.googleapis.com/auth/content openid email",
            token_type: "Bearer",
            id_token: idToken(),
          })
          return
        }
        if (
          form.get("grant_type") === "refresh_token" &&
          refreshTokens.has(form.get("refresh_token") ?? "")
        ) {
          const access = `ya29.${randomId(24)}`
          accessTokens.add(access)
          json(res, 200, { access_token: access, expires_in: 3599, token_type: "Bearer" })
          return
        }
        json(res, 400, { error: "invalid_grant" })
        return
      }
      if (req.method === "POST" && url.pathname === "/revoke") {
        const token = new URLSearchParams(body).get("token") ?? ""
        refreshTokens.delete(token)
        revoked.push(token)
        json(res, 200, {})
        return
      }
      if (!accessTokens.has(bearer)) {
        apiError(res, 401, "UNAUTHENTICATED")
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
        json(res, 200, { name: `accounts/${merchantId}`, accountName: "Örnek Mağaza" })
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
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address() as AddressInfo

  return {
    url: `http://127.0.0.1:${String(address.port)}`,
    client,
    merchantId,
    email,
    products,
    inserts,
    dataSources,
    revoked,
    consent: (authorizationUrl, answer = "allow") => {
      const asked = new URL(authorizationUrl)
      const params = asked.searchParams
      const redirect = new URL(params.get("redirect_uri") ?? "")
      redirect.searchParams.set("state", params.get("state") ?? "")
      const valid =
        params.get("client_id") === client.clientId &&
        params.get("response_type") === "code" &&
        params.get("code_challenge_method") === "S256" &&
        params.get("access_type") === "offline" &&
        (params.get("scope") ?? "").split(" ").includes("https://www.googleapis.com/auth/content")
      if (answer === "deny" || !valid) {
        redirect.searchParams.set("error", valid ? "access_denied" : "invalid_request")
        return Promise.resolve(redirect.toString())
      }
      const code = `4/${randomId(24)}`
      codes.set(code, {
        challenge: params.get("code_challenge") ?? "",
        redirectUri: params.get("redirect_uri") ?? "",
      })
      redirect.searchParams.set("code", code)
      return Promise.resolve(redirect.toString())
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
