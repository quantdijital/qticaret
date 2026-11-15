import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { ADDRESS_VOUCHING_PROVIDERS, customerAuthProviders } from "../../../lib/auth/providers"
import type { Env } from "../../../lib/env"
import { logger } from "../../../lib/logging"
import { confirmedByOwnLogin, provenCustomer } from "../proven-customer"

interface Identity {
  id: string
  customer_id?: string
  provider: string
  /** The e-mail login's address, or the address a social provider vouched for, as stored. */
  email: string
}

interface Verification {
  auth_identity_id: string
  entity_id: string
  verified_at: string | null
}

type Filters = Record<string, unknown>

const ilike = (filter: unknown): string =>
  ((filter as { $ilike?: string } | undefined)?.$ilike ?? "").replace(/\\(.)/g, "$1").toLowerCase()

interface Options {
  verifications?: Verification[]
  /** The identities' read fails (a database error). */
  socialReadFails?: boolean
  /** The identities' read ignores its filter and answers every identity. */
  filterIgnored?: boolean
}

/**
 * The auth service and query as `provenCustomer` reads them: e-mail logins
 * by address, identities by id, verifications by identity and address,
 * and a customer's identities with their provider rows.
 */
function shop(
  customer: { email: string | null; has_account: boolean } | null,
  identities: Identity[],
  options: Options = {}
) {
  const { verifications = [], socialReadFails = false, filterIgnored = false } = options
  const auth = {
    listProviderIdentities: (filters: Filters) => {
      const address = ilike(filters["entity_id"])
      return Promise.resolve(
        identities
          .filter((each) => each.provider === "emailpass" && each.email.toLowerCase() === address)
          .map((each) => ({ auth_identity_id: each.id }))
      )
    },
    listAuthIdentities: (filters: { id: string[] }) =>
      Promise.resolve(
        identities
          .filter((each) => filters.id.includes(each.id))
          .map((each) => ({
            id: each.id,
            app_metadata: each.customer_id ? { customer_id: each.customer_id } : {},
          }))
      ),
    listAuthVerifications: (filters: Filters) => {
      const address = ilike(filters["entity_id"])
      const own = filters["auth_identity_id"] as string[]
      return Promise.resolve(
        verifications.filter(
          (each) => each.entity_id === address && own.includes(each.auth_identity_id)
        )
      )
    },
  }
  const query = {
    graph: (input: { entity: string; filters: Filters }) => {
      if (input.entity === "customer") {
        return Promise.resolve({ data: customer ? [customer] : [] })
      }
      if (socialReadFails) {
        return Promise.reject(new Error("select … where email = 'ali@example.com'"))
      }
      const wanted = (input.filters["app_metadata"] as { customer_id: string }).customer_id
      return Promise.resolve({
        data: identities
          .filter((each) => filterIgnored || each.customer_id === wanted)
          .map((each) => ({
            id: each.id,
            app_metadata: each.customer_id ? { customer_id: each.customer_id } : {},
            provider_identities: [
              { provider: each.provider, user_metadata: { email: each.email } },
            ],
          })),
      })
    },
  }
  return {
    resolve: (key: string) => {
      if (key === ContainerRegistrationKeys.QUERY) {
        return query
      }
      if (key === Modules.AUTH) {
        return auth
      }
      throw new Error(`unexpected ${key}`)
    },
  }
}

const EMAIL = "ali_veli@example.com"
const member = { email: "Ali_Veli@Example.com", has_account: true }
const login = { id: "authid_1", customer_id: "cus_1", provider: "emailpass", email: EMAIL }
const confirmed = { auth_identity_id: "authid_1", entity_id: EMAIL, verified_at: "2026-11-15" }
const apple = { id: "authid_3", customer_id: "cus_1", provider: "apple", email: EMAIL }

/** Security review of ADR-0068 slice 1b, H1, and of PR #73: what proves an address. */
describe("whether a customer has proven their address", () => {
  it("is proven by the e-mail login's own address confirmed in its own session", async () => {
    const container = shop(member, [login], { verifications: [confirmed] })
    expect(await provenCustomer(container, "cus_1")).toBe(true)
    expect(await confirmedByOwnLogin(container, "cus_1")).toBe(true)
  })

  it("is not proven by a registration never confirmed: has_account alone is no proof", async () => {
    expect(await provenCustomer(shop(member, [login]), "cus_1")).toBe(false)
    const unverified = { verifications: [{ ...confirmed, verified_at: null }] }
    expect(await provenCustomer(shop(member, [login], unverified), "cus_1")).toBe(false)
  })

  it("is not proven by a code confirmed for another address, or by another identity", async () => {
    const elsewhere = { ...confirmed, entity_id: "kendi@example.com" }
    expect(
      await provenCustomer(shop(member, [login], { verifications: [elsewhere] }), "cus_1")
    ).toBe(false)
    // Another identity confirmed a code for this address in its own session: no proof here
    const accomplice = {
      id: "authid_2",
      customer_id: "cus_2",
      provider: "emailpass",
      email: "y@example.com",
    }
    const theirs = { ...confirmed, auth_identity_id: "authid_2" }
    const container = shop(member, [login, accomplice], { verifications: [theirs] })
    expect(await provenCustomer(container, "cus_1")).toBe(false)
    expect(await confirmedByOwnLogin(container, "cus_1")).toBe(false)
  })

  it("is proven by its own social sign-in from a provider that verifies addresses, in any case", async () => {
    expect(await provenCustomer(shop(member, [login, apple]), "cus_1")).toBe(true)
    // Google keeps the address as the person wrote it (Medusa 2.21.2)
    const google = { ...apple, provider: "google", email: " Ali_Veli@EXAMPLE.com " }
    expect(await provenCustomer(shop(member, [login, google]), "cus_1")).toBe(true)
    // A social sign-in is no e-mail confirmation: it never joins another (adr/0037 §3)
    expect(await confirmedByOwnLogin(shop(member, [login, apple]), "cus_1")).toBe(false)
  })

  it("is not proven by a provider off the list, another customer's sign-in or another address", async () => {
    const unlisted = { ...apple, provider: "github" }
    expect(await provenCustomer(shop(member, [login, unlisted]), "cus_1")).toBe(false)
    const others = { ...apple, customer_id: "cus_2" }
    expect(await provenCustomer(shop(member, [login, others]), "cus_1")).toBe(false)
    // Even if the read answered every identity, another customer's proves nothing
    expect(
      await provenCustomer(shop(member, [login, others], { filterIgnored: true }), "cus_1")
    ).toBe(false)
    const elsewhere = { ...apple, email: "ali.veli@example.com" }
    expect(await provenCustomer(shop(member, [login, elsewhere]), "cus_1")).toBe(false)
  })

  it("counts a social read that fails as no proof, and logs no value of the query", async () => {
    const warn = jest.spyOn(logger, "warn").mockImplementation(() => undefined)
    expect(await provenCustomer(shop(member, [apple], { socialReadFails: true }), "cus_1")).toBe(
      false
    )
    expect(warn).toHaveBeenCalledWith({ event: "account.social_proof_unread", error: "Error" })
    expect(JSON.stringify(warn.mock.calls)).not.toContain("@example.com")
    warn.mockRestore()
  })

  it("is never proven for a guest record, a customer without an address, or none", async () => {
    for (const customer of [
      { email: EMAIL, has_account: false },
      { email: null, has_account: true },
      { email: "  ", has_account: true },
      null,
    ]) {
      const container = shop(customer, [login, apple], { verifications: [confirmed] })
      expect(await provenCustomer(container, "cus_1")).toBe(false)
      expect(await confirmedByOwnLogin(container, "cus_1")).toBe(false)
    }
  })
})

describe("the providers whose sign-in proves an address", () => {
  it("lists every social provider the shop can offer a customer", () => {
    const env = {
      GOOGLE_AUTH_CLIENT_ID: "id",
      GOOGLE_AUTH_CLIENT_SECRET: "placeholder",
      GOOGLE_AUTH_CALLBACK_URL: "https://magaza.example.com/hesap/giris/google",
      APPLE_AUTH_CLIENT_ID: "id",
      APPLE_AUTH_TEAM_ID: "team",
      APPLE_AUTH_KEY_ID: "key",
      APPLE_AUTH_PRIVATE_KEY: "placeholder",
      APPLE_AUTH_CALLBACK_URL: "https://magaza.example.com/hesap/giris/apple",
    } as unknown as Env
    const social = customerAuthProviders(env).ids.filter((id) => id !== "emailpass")
    expect(social.length).toBeGreaterThan(0)
    expect(social.filter((id) => !ADDRESS_VOUCHING_PROVIDERS.includes(id))).toEqual([])
  })
})
