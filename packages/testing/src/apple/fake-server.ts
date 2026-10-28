import { generateKeyPairSync, randomBytes, sign, verify } from "node:crypto"
import type { KeyObject } from "node:crypto"
import { createServer } from "node:http"
import type { AddressInfo, Socket } from "node:net"

/**
 * A stand-in for Sign in with Apple's REST API (adr/0037 §3): the token
 * endpoint (`POST /auth/token`, form body, an ES256 client secret it
 * checks) and the keys (`GET /auth/keys`) its RS256 identity tokens are
 * signed with. A test issues a code as Apple would after a sign-in.
 */

export interface FakeAppleAccount {
  clientId: string
  teamId: string
  keyId: string
  /** The client's ES256 key in PEM, as the shop's .p8 would be: random each run. */
  privateKey: string
  publicKey: KeyObject
}

export interface FakeAppleSignIn {
  sub: string
  email: string
  nonce: string
  emailVerified?: boolean
  /** Signed with a key Apple's list does not have: a forged token. */
  forged?: boolean
}

export interface FakeApple {
  url: string
  account: FakeAppleAccount
  /** A code for this sign-in, good once, as Apple posts it to the storefront. */
  issue: (signIn: FakeAppleSignIn) => string
  /** How many client secrets were refused. */
  refused: () => number
  close: () => Promise<void>
}

const ISSUER = "https://appleid.apple.com"
const upper = (bytes: number) => randomBytes(bytes).toString("hex").toUpperCase().slice(0, 10)

/** A random client each run: no fixed key a scanner could take for a real one (docs/04). */
export function fakeAppleAccount(): FakeAppleAccount {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" })
  return {
    clientId: `com.magaza.test.${randomBytes(4).toString("hex")}`,
    teamId: upper(5),
    keyId: upper(5),
    privateKey: privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
    publicKey,
  }
}

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url")
const decode = (part: string | undefined): Record<string, unknown> | null => {
  try {
    return JSON.parse(Buffer.from(part ?? "", "base64url").toString("utf8")) as Record<
      string,
      unknown
    >
  } catch {
    return null
  }
}

export async function startFakeApple(
  account: FakeAppleAccount = fakeAppleAccount(),
  options: { port?: number } = {}
): Promise<FakeApple> {
  const signing = generateKeyPairSync("rsa", { modulusLength: 2048 })
  const stranger = generateKeyPairSync("rsa", { modulusLength: 2048 })
  const kid = randomBytes(5).toString("hex")
  const codes = new Map<string, FakeAppleSignIn>()
  const sockets = new Set<Socket>()
  let refusedSecrets = 0

  const idToken = (signIn: FakeAppleSignIn) => {
    const now = Math.floor(Date.now() / 1000)
    const input = `${encode({ alg: "RS256", kid })}.${encode({
      iss: ISSUER,
      aud: account.clientId,
      sub: signIn.sub,
      email: signIn.email,
      email_verified: signIn.emailVerified === false ? "false" : "true",
      nonce: signIn.nonce,
      iat: now,
      exp: now + 600,
    })}`
    const key = signIn.forged ? stranger.privateKey : signing.privateKey
    return `${input}.${sign("RSA-SHA256", Buffer.from(input), key).toString("base64url")}`
  }

  /** Whether the client secret is the client's own: its key, team, id and Apple as audience. */
  const goodSecret = (secret: string) => {
    const [head, body, signature] = secret.split(".")
    const header = decode(head)
    const claims = decode(body)
    const now = Math.floor(Date.now() / 1000)
    return (
      header?.["alg"] === "ES256" &&
      header["kid"] === account.keyId &&
      claims?.["iss"] === account.teamId &&
      claims["sub"] === account.clientId &&
      claims["aud"] === ISSUER &&
      typeof claims["exp"] === "number" &&
      claims["exp"] > now &&
      verify(
        "sha256",
        Buffer.from(`${head ?? ""}.${body ?? ""}`),
        { key: account.publicKey, dsaEncoding: "ieee-p1363" },
        Buffer.from(signature ?? "", "base64url")
      )
    )
  }

  const server = createServer((req, res) => {
    let body = ""
    req.on("data", (chunk: Buffer) => (body += chunk.toString()))
    req.on("end", () => {
      try {
        answer()
      } catch {
        // A fake's own fault answers at once, never leaves the client waiting
        res.writeHead(500).end()
      }
    })
    const answer = () => {
      const json = (status: number, value: unknown) => {
        res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(value))
      }
      if (req.method === "GET" && req.url === "/auth/keys") {
        const jwk = signing.publicKey.export({ format: "jwk" })
        json(200, { keys: [{ ...jwk, kid, use: "sig", alg: "RS256" }] })
        return
      }
      if (req.method === "POST" && req.url === "/auth/token") {
        const form = new URLSearchParams(body)
        if (
          form.get("client_id") !== account.clientId ||
          !goodSecret(form.get("client_secret") ?? "")
        ) {
          refusedSecrets += 1
          json(400, { error: "invalid_client" })
          return
        }
        const signIn = codes.get(form.get("code") ?? "")
        if (!signIn || form.get("grant_type") !== "authorization_code") {
          json(400, { error: "invalid_grant" })
          return
        }
        codes.delete(form.get("code") ?? "")
        json(200, {
          access_token: randomBytes(16).toString("hex"),
          token_type: "Bearer",
          expires_in: 3600,
          refresh_token: randomBytes(16).toString("hex"),
          id_token: idToken(signIn),
        })
        return
      }
      res.writeHead(404).end()
    }
  })
  server.on("connection", (socket) => {
    sockets.add(socket)
    socket.on("close", () => sockets.delete(socket))
  })
  await new Promise<void>((resolve) => server.listen(options.port ?? 0, "127.0.0.1", resolve))
  const address = server.address() as AddressInfo

  return {
    url: `http://127.0.0.1:${String(address.port)}`,
    account,
    issue: (signIn) => {
      const code = randomBytes(16).toString("hex")
      codes.set(code, signIn)
      return code
    },
    refused: () => refusedSecrets,
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
