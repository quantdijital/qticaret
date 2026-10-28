import { generateKeyPairSync, sign, verify } from "node:crypto"
import { APPLE_ISSUER, appleClientSecret, appleNameOf, verifyAppleIdToken } from "../apple"

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url")
const part = (token: string, index: number) =>
  JSON.parse(Buffer.from(token.split(".")[index] ?? "", "base64url").toString("utf8")) as Record<
    string,
    unknown
  >

/** adr/0037 §3: Sign in with Apple's JWTs, made and checked with node's crypto. */
describe("Apple client secret", () => {
  it("is an ES256 JWT for the client, signed with its key, good for minutes", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" })
    const now = new Date("2026-10-28T12:00:00Z")
    const secret = appleClientSecret({
      teamId: "TEAM123456",
      keyId: "KEY1234567",
      clientId: "com.magaza.web",
      privateKey: privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
      now,
    })
    const [head, body, signature] = secret.split(".")

    expect(part(secret, 0)).toEqual({ alg: "ES256", kid: "KEY1234567" })
    expect(part(secret, 1)).toEqual({
      iss: "TEAM123456",
      iat: 1793188800,
      exp: 1793188800 + 300,
      aud: APPLE_ISSUER,
      sub: "com.magaza.web",
    })
    expect(
      verify(
        "sha256",
        Buffer.from(`${head ?? ""}.${body ?? ""}`),
        { key: publicKey, dsaEncoding: "ieee-p1363" },
        Buffer.from(signature ?? "", "base64url")
      )
    ).toBe(true)
  })
})

describe("Apple identity token", () => {
  const apple = generateKeyPairSync("rsa", { modulusLength: 2048 })
  const keys = [{ ...apple.publicKey.export({ format: "jwk" }), kid: "k1" }]
  const now = new Date("2026-10-28T12:00:00Z")
  const seconds = Math.floor(now.getTime() / 1000)
  const token = (claims: Record<string, unknown>, key = apple.privateKey, kid = "k1") => {
    const input = `${encode({ alg: "RS256", kid })}.${encode({
      iss: APPLE_ISSUER,
      aud: "com.magaza.web",
      sub: "001.abc",
      email: "Ayse@PrivateRelay.example",
      email_verified: "true",
      nonce: "n1",
      exp: seconds + 600,
      ...claims,
    })}`
    return `${input}.${sign("RSA-SHA256", Buffer.from(input), key).toString("base64url")}`
  }
  const check = (idToken: string) =>
    verifyAppleIdToken(idToken, keys, { clientId: "com.magaza.web", nonce: "n1", now })

  it("reads the person Apple signed for this client and sign-in", () => {
    expect(check(token({}))).toEqual({
      sub: "001.abc",
      email: "ayse@privaterelay.example",
      emailVerified: true,
      isPrivateEmail: false,
    })
  })

  it("reads nothing from another client, sign-in, issuer, a past token or a forged one", () => {
    const stranger = generateKeyPairSync("rsa", { modulusLength: 2048 })
    expect(check(token({ aud: "com.baska.web" }))).toBeNull()
    expect(check(token({ nonce: "n2" }))).toBeNull()
    expect(check(token({ iss: "https://evil.example" }))).toBeNull()
    expect(check(token({ exp: seconds - 1 }))).toBeNull()
    expect(check(token({}, stranger.privateKey))).toBeNull()
    expect(check(token({}, apple.privateKey, "k2"))).toBeNull()
    expect(check("a.b.c")).toBeNull()
  })
})

describe("Apple's name, sent once", () => {
  it("keeps two short plain strings and nothing else", () => {
    expect(
      appleNameOf(JSON.stringify({ name: { firstName: " Ayşe ", lastName: "<b>Yılmaz</b>" } }))
    ).toEqual({ firstName: "Ayşe", lastName: "bYılmaz/b" })
    expect(appleNameOf("{not json")).toEqual({ firstName: null, lastName: null })
    expect(appleNameOf({ name: { firstName: 42 } })).toEqual({ firstName: null, lastName: null })
  })
})
