import { generateKeyPairSync, sign } from "node:crypto"
import { MedusaError } from "@medusajs/framework/utils"
import googleProvider from "@medusajs/medusa/auth-google"
import { ADDRESS_VOUCHING_PROVIDERS } from "../providers"

/**
 * Google is on `ADDRESS_VOUCHING_PROVIDERS` because Medusa's provider
 * (2.21.2) refuses an address Google has not verified: its sign-in then
 * proves the address (`provenCustomer`). Its endpoints are fixed in the
 * provider, so no fake Google server can stand in for it over HTTP; the
 * provider is run here on a token signed with a key of our own. If an
 * upgrade lets an unverified address through, this fails and Google must
 * come off the list.
 */

interface IdentityStore {
  retrieve: jest.Mock
  create: jest.Mock
}

interface GoogleService {
  jwks_: {
    getSigningKey: (kid: string, done: (error: Error | null, key?: unknown) => void) => void
  }
  verify_: (token: string, store: IdentityStore) => Promise<{ success: boolean; error?: string }>
}

const CLIENT_ID = "magaza.apps.googleusercontent.com"
const keys = generateKeyPairSync("rsa", { modulusLength: 2048 })
const publicKey = keys.publicKey.export({ type: "spki", format: "pem" }).toString()

const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url")

function idToken(claims: Record<string, unknown>): string {
  const now = Math.floor(Date.now() / 1000)
  const unsigned = `${part({ alg: "RS256", typ: "JWT", kid: "test-key" })}.${part({
    iss: "https://accounts.google.com",
    aud: CLIENT_ID,
    sub: "1098765",
    iat: now,
    exp: now + 300,
    email: "Ali.Veli@Example.com",
    ...claims,
  })}`
  const signature = sign("RSA-SHA256", Buffer.from(unsigned), keys.privateKey).toString("base64url")
  return `${unsigned}.${signature}`
}

function service(): GoogleService {
  const [Service] = (
    googleProvider as unknown as { services: (new (...args: unknown[]) => unknown)[] }
  ).services
  if (!Service) {
    throw new Error("Medusa's Google provider has no service")
  }
  const google = new Service(
    { logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } },
    { clientId: CLIENT_ID, clientSecret: "test-only", callbackUrl: "https://magaza.example.com/g" }
  ) as GoogleService
  google.jwks_ = {
    getSigningKey: (_kid, done) => {
      done(null, { getPublicKey: () => publicKey })
    },
  }
  return google
}

function identities(): IdentityStore {
  return {
    retrieve: jest.fn(() =>
      Promise.reject(new MedusaError(MedusaError.Types.NOT_FOUND, "no identity"))
    ),
    create: jest.fn((data: unknown) => Promise.resolve({ id: "authid_1", ...(data as object) })),
  }
}

const outcome = (google: GoogleService, token: string, store: IdentityStore) =>
  google.verify_(token, store).catch((error: unknown) => ({
    success: false,
    error: error instanceof Error ? error.message : "",
  }))

describe("Medusa's Google sign-in (security review of PR #73)", () => {
  it("is on the list of providers whose sign-in proves an address", () => {
    expect(ADDRESS_VOUCHING_PROVIDERS).toContain("google")
  })

  it("refuses an address Google has not verified, and keeps no identity for it", async () => {
    const store = identities()
    const refused = await outcome(service(), idToken({ email_verified: false }), store)
    const missing = await outcome(service(), idToken({}), store)

    expect(refused.success).toBe(false)
    expect(missing.success).toBe(false)
    expect(store.create).not.toHaveBeenCalled()
  })

  it("takes a verified one, keeping the address as Google wrote it", async () => {
    const store = identities()
    const taken = await outcome(service(), idToken({ email_verified: true }), store)

    expect(taken.success).toBe(true)
    expect(store.create).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_id: "1098765",
        user_metadata: expect.objectContaining({ email: "Ali.Veli@Example.com" }) as unknown,
      })
    )
  })

  it("refuses a token signed with another key", async () => {
    const other = generateKeyPairSync("rsa", { modulusLength: 2048 })
    const google = service()
    google.jwks_ = {
      getSigningKey: (_kid, done) => {
        done(null, {
          getPublicKey: () => other.publicKey.export({ type: "spki", format: "pem" }).toString(),
        })
      },
    }
    const store = identities()

    expect((await outcome(google, idToken({ email_verified: true }), store)).success).toBe(false)
    expect(store.create).not.toHaveBeenCalled()
  })
})
