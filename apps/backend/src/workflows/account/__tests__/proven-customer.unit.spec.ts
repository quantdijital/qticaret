import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { provenCustomer } from "../proven-customer"

interface Identity {
  id: string
  customer_id?: string
  provider: string
  /** The e-mail login's address, or the address a social provider vouched for. */
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

/**
 * The auth service as `provenCustomer` reads it: provider identities by
 * provider and address, identities by id, verifications by identity and
 * address. Enough of Medusa's filters to tell the cases apart.
 */
function shop(
  customer: { email: string | null; has_account: boolean } | null,
  identities: Identity[],
  verifications: Verification[] = [],
  socialReadFails = false
) {
  const auth = {
    listProviderIdentities: (filters: Filters) => {
      if (filters["provider"] === "emailpass") {
        const address = ilike(filters["entity_id"])
        return Promise.resolve(
          identities
            .filter((each) => each.provider === "emailpass" && each.email === address)
            .map((each) => ({ auth_identity_id: each.id }))
        )
      }
      if (socialReadFails) {
        return Promise.reject(new Error("json filter"))
      }
      const address = (filters["user_metadata"] as { email: string }).email
      return Promise.resolve(
        identities
          .filter((each) => each.provider !== "emailpass" && each.email === address)
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
  const query = { graph: () => Promise.resolve({ data: customer ? [customer] : [] }) }
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

/** Security review of ADR-0068 slice 1b, H1, and of PR #73: what proves an address. */
describe("whether a customer has proven their address", () => {
  it("is proven by the e-mail login's own address confirmed in its own session", async () => {
    expect(await provenCustomer(shop(member, [login], [confirmed]), "cus_1")).toBe(true)
  })

  it("is not proven by a registration never confirmed: has_account alone is no proof", async () => {
    expect(await provenCustomer(shop(member, [login]), "cus_1")).toBe(false)
    expect(
      await provenCustomer(shop(member, [login], [{ ...confirmed, verified_at: null }]), "cus_1")
    ).toBe(false)
  })

  it("is not proven by a code confirmed for another address, or by another identity", async () => {
    const elsewhere = { ...confirmed, entity_id: "kendi@example.com" }
    const stranger = { id: "authid_2", customer_id: "cus_2", provider: "emailpass", email: EMAIL }
    expect(await provenCustomer(shop(member, [login], [elsewhere]), "cus_1")).toBe(false)
    // A sign-in of another customer with the address, confirmed, proves nothing for this one
    expect(
      await provenCustomer(
        shop(member, [{ ...login, customer_id: "cus_2" }, stranger], [confirmed]),
        "cus_1"
      )
    ).toBe(false)
  })

  it("is proven by a social sign-in of the customer whose provider vouched for the address", async () => {
    const apple = { id: "authid_3", customer_id: "cus_1", provider: "apple", email: EMAIL }
    expect(await provenCustomer(shop(member, [login, apple]), "cus_1")).toBe(true)
    // Another customer's social sign-in with the address vouches for nobody else
    expect(
      await provenCustomer(shop(member, [login, { ...apple, customer_id: "cus_2" }]), "cus_1")
    ).toBe(false)
  })

  it("counts a social read that fails as no proof", async () => {
    const apple = { id: "authid_3", customer_id: "cus_1", provider: "apple", email: EMAIL }
    expect(await provenCustomer(shop(member, [apple], [], true), "cus_1")).toBe(false)
  })

  it("is never proven for a guest record, a customer without an address, or none", async () => {
    for (const customer of [
      { email: EMAIL, has_account: false },
      { email: null, has_account: true },
      { email: "  ", has_account: true },
      null,
    ]) {
      expect(await provenCustomer(shop(customer, [login], [confirmed]), "cus_1")).toBe(false)
    }
  })
})
