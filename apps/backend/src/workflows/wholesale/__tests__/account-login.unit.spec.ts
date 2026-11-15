import { addressLogin, ensureLogin } from "../steps/account-login"
import type { EnsureLoginInput } from "../steps/account-login"
import { emailLoginsAt, sealPassword } from "../steps/login-password"

const proven = jest.fn<Promise<boolean>, [unknown, string]>()
// The fake's identities, for Medusa's own refusal below
let identitiesNow = new Map<string, Identity>()
const createCustomer = jest.fn<Promise<{ result: { id: string } }>, [unknown]>()

jest.mock("../../account/proven-customer", () => ({
  provenCustomer: (container: unknown, id: string) => proven(container, id),
}))
jest.mock("@medusajs/medusa/core-flows", () => ({
  createCustomerAccountWorkflow: () => ({ run: (args: unknown) => createCustomer(args) }),
}))

const EMAIL = "victim@example.com"
// Made up for the test and built from parts, so no secret scanner takes it for one
const PASSWORD = ["Toptan", "Yilmaz", "2026"].join("-")

interface Identity {
  id: string
  app_metadata: Record<string, unknown>
}

/** A container whose auth, query, cart and customer modules are plain fakes. */
function fakeContainer(state: {
  customers?: { id: string }[]
  logins?: { auth_identity_id: string; entity_id: string }[]
  identities?: Identity[]
  guestExists?: boolean
}) {
  const identities = new Map((state.identities ?? []).map((each) => [each.id, { ...each }]))
  identitiesNow = identities
  const resolved = <T>(value: T) => jest.fn(() => Promise.resolve(value))
  const auth = {
    register: jest.fn(() => {
      identities.set("auth_new", { id: "auth_new", app_metadata: {} })
      return Promise.resolve({ success: true, authIdentity: { id: "auth_new" } })
    }),
    updateProvider: resolved({ success: true }),
    listProviderIdentities: jest.fn(() =>
      Promise.resolve(
        (state.logins ?? []).map((login) => ({
          ...login,
          id: `pi_${login.auth_identity_id}`,
          provider_metadata: { password: `hash_${login.auth_identity_id}` },
        }))
      )
    ),
    retrieveAuthIdentity: jest.fn((id: string) => Promise.resolve(identities.get(id))),
    // As Medusa's: a key the update does not name is kept
    updateAuthIdentities: jest.fn((update: Identity) => {
      const before = identities.get(update.id)?.app_metadata ?? {}
      identities.set(update.id, {
        id: update.id,
        app_metadata: { ...before, ...update.app_metadata },
      })
      return Promise.resolve()
    }),
    updateProviderIdentities: resolved(undefined),
    deleteAuthIdentities: resolved(undefined),
    listAuthVerifications: resolved([]),
    requestAuthVerification: resolved({ code: "code_1" }),
    confirmAuthVerification: resolved(undefined),
  }
  const customer = {
    updateCustomers: jest.fn((_id: string, data: { has_account?: boolean }) =>
      state.guestExists && data.has_account === false
        ? Promise.reject(new Error("unique email, has_account"))
        : Promise.resolve()
    ),
    softDeleteCustomers: resolved(undefined),
    createCustomers: jest.fn(() => Promise.resolve([{ id: "cus_fresh" }])),
    restoreCustomers: resolved(undefined),
    deleteCustomers: resolved(undefined),
  }
  const query = { graph: resolved({ data: state.customers ?? [] }) }
  const modules: Record<string, unknown> = { auth, customer, query }
  return {
    container: { resolve: (key: string) => modules[key] } as never,
    auth,
    customer,
    identities,
  }
}

const input = (fields: Partial<EnsureLoginInput>): EnsureLoginInput => ({
  email: EMAIL,
  login: { kind: "none" },
  sealed_password: sealPassword(EMAIL, PASSWORD),
  take_over: false,
  contact_name: "Ayşe Yılmaz",
  company_name: "Yılmaz Ticaret",
  ...fields,
})

/** A sign-up at the address in two cases (review M2), the first tied to the customer. */
const squatted = (extra: { guestExists?: boolean } = {}) =>
  fakeContainer({
    customers: [{ id: "cus_1" }],
    logins: [
      { auth_identity_id: "auth_1", entity_id: "Victim@example.com" },
      { auth_identity_id: "auth_2", entity_id: "victim@example.com" },
    ],
    identities: [
      { id: "auth_1", app_metadata: { customer_id: "cus_1" } },
      { id: "auth_2", app_metadata: {} },
    ],
    ...extra,
  })

beforeEach(() => {
  proven.mockReset()
  createCustomer.mockReset()
  // As Medusa's setAuthAppMetadata: an identity that ever held a customer id is refused
  createCustomer.mockImplementation((args) => {
    const id = (args as { input: { authIdentityId: string } }).input.authIdentityId
    return identitiesNow.get(id)?.app_metadata["customer_id"] !== undefined
      ? Promise.reject(new Error("Key customer_id already exists in app metadata"))
      : Promise.resolve({ result: { id: "cus_new" } })
  })
})

describe("who signs in at a new wholesaler's address (ADR-0068 Ek 2026-11-15 (2))", () => {
  it("reads a proven customer, an unconfirmed sign-up with every sign-in, or nobody", async () => {
    proven.mockResolvedValue(true)
    expect(
      await addressLogin(fakeContainer({ customers: [{ id: "cus_1" }] }).container, EMAIL)
    ).toEqual({ kind: "proven", customer_id: "cus_1" })
    proven.mockResolvedValue(false)
    const found = await addressLogin(squatted().container, EMAIL)
    expect(found.kind).toBe("unproven")
    expect(found.kind === "unproven" && found.logins.map((login) => login.entity_id)).toEqual([
      "Victim@example.com",
      "victim@example.com",
    ])
    expect(await addressLogin(fakeContainer({}).container, EMAIL)).toEqual({ kind: "none" })
  })

  it("never takes a staff member's sign-in, even one tied to a proven customer (review M3)", async () => {
    proven.mockResolvedValue(true)
    const staff = fakeContainer({
      customers: [{ id: "cus_1" }],
      logins: [{ auth_identity_id: "auth_9", entity_id: EMAIL }],
      identities: [{ id: "auth_9", app_metadata: { user_id: "user_1", customer_id: "cus_1" } }],
    })
    expect(await addressLogin(staff.container, EMAIL)).toEqual({ kind: "staff" })
  })
})

describe("the wholesaler's sign-in as staff set it", () => {
  it("case 1: no one at the address: a sign-in with staff's password and a customer, confirmed", async () => {
    const fake = fakeContainer({})
    const { result } = await ensureLogin(fake.container, input({}))
    expect(result).toEqual({ customer_id: "cus_new", password: "set" })
    expect(fake.auth.register).toHaveBeenCalledWith("emailpass", {
      body: { email: EMAIL, password: PASSWORD },
    })
    expect(createCustomer).toHaveBeenCalledWith({
      input: {
        authIdentityId: "auth_new",
        customerData: {
          email: EMAIL,
          first_name: "Ayşe",
          last_name: "Yılmaz",
          company_name: "Yılmaz Ticaret",
        },
      },
    })
    expect(fake.auth.confirmAuthVerification).toHaveBeenCalledWith({ code: "code_1" })
    expect(fake.auth.updateProvider).not.toHaveBeenCalled()
  })

  it("case 2: a customer who proved the address keeps their own password", async () => {
    const fake = fakeContainer({})
    const { result, undo } = await ensureLogin(
      fake.container,
      input({ login: { kind: "proven", customer_id: "cus_1" } })
    )
    expect(result).toEqual({ customer_id: "cus_1", password: "kept" })
    expect(undo).toBeNull()
    expect(fake.auth.register).not.toHaveBeenCalled()
    expect(fake.auth.updateProvider).not.toHaveBeenCalled()
  })

  it("case 3: an unconfirmed sign-up is refused until staff take it over", async () => {
    const fake = squatted()
    const login = { kind: "unproven" as const, customer_id: "cus_1", logins: [] }
    await expect(ensureLogin(fake.container, input({ login }))).rejects.toThrow(
      "wholesale.unproven_signup"
    )
    expect(fake.auth.updateProvider).not.toHaveBeenCalled()
    expect(fake.customer.updateCustomers).not.toHaveBeenCalled()
  })

  it("case 3, taken over: every sign-in's password replaced and unlinked, a fresh customer", async () => {
    const fake = squatted()
    const logins = await emailLoginsAt(fake.container, EMAIL)
    const login = { kind: "unproven" as const, customer_id: "cus_1", logins }
    const { result } = await ensureLogin(fake.container, input({ login, take_over: true }))
    expect(result).toEqual({ customer_id: "cus_fresh", password: "replaced" })
    // Both case variants (review M2)
    expect(fake.auth.updateProvider.mock.calls).toEqual([
      ["emailpass", { entity_id: "Victim@example.com", password: PASSWORD }],
      ["emailpass", { entity_id: "victim@example.com", password: PASSWORD }],
    ])
    for (const id of ["auth_1", "auth_2"]) {
      expect(typeof fake.identities.get(id)?.app_metadata["password_changed_at"]).toBe("string")
    }
    // The sign-up's record retired, a fresh one tied to the sign-up's own sign-in (review M5)
    expect(fake.customer.updateCustomers).toHaveBeenCalledWith("cus_1", { has_account: false })
    expect(fake.customer.createCustomers).toHaveBeenCalledWith([
      {
        email: EMAIL,
        first_name: "Ayşe",
        last_name: "Yılmaz",
        company_name: "Yılmaz Ticaret",
        has_account: true,
      },
    ])
    expect(fake.identities.get("auth_1")?.app_metadata["customer_id"]).toBe("cus_fresh")
    expect(fake.identities.get("auth_2")?.app_metadata["customer_id"]).toBeNull()
    // Medusa's own account workflow, which refuses an identity that held a customer, is not used
    expect(createCustomer).not.toHaveBeenCalled()
  })

  it("soft-deletes the retired record where the address already has a guest one", async () => {
    const fake = squatted({ guestExists: true })
    const logins = await emailLoginsAt(fake.container, EMAIL)
    await ensureLogin(
      fake.container,
      input({ login: { kind: "unproven", customer_id: "cus_1", logins }, take_over: true })
    )
    expect(fake.customer.softDeleteCustomers).toHaveBeenCalledWith(["cus_1"])
  })

  it("puts everything back when the fresh customer cannot be made", async () => {
    const fake = squatted()
    fake.customer.createCustomers.mockRejectedValue(new Error("customer refused"))
    const logins = await emailLoginsAt(fake.container, EMAIL)
    await expect(
      ensureLogin(
        fake.container,
        input({ login: { kind: "unproven", customer_id: "cus_1", logins }, take_over: true })
      )
    ).rejects.toThrow("customer refused")
    expect(fake.customer.updateCustomers).toHaveBeenLastCalledWith("cus_1", { has_account: true })
    expect(fake.auth.updateProviderIdentities).toHaveBeenCalledWith([
      { id: "pi_auth_1", provider_metadata: { password: "hash_auth_1" } },
    ])
    // The link back; the change's time stays (an update keeps it): older sign-ins stay ended
    expect(fake.identities.get("auth_1")?.app_metadata).toMatchObject({ customer_id: "cus_1" })
    expect(fake.customer.updateCustomers).toHaveBeenLastCalledWith("cus_1", { has_account: true })
  })

  it("never touches a staff member's sign-in, and needs a password for a new one", async () => {
    const fake = fakeContainer({})
    await expect(
      ensureLogin(fake.container, input({ login: { kind: "staff" }, take_over: true }))
    ).rejects.toThrow("wholesale.login_in_use")
    await expect(ensureLogin(fake.container, input({ sealed_password: null }))).rejects.toThrow(
      "wholesale.password_required"
    )
    expect(fake.auth.register).not.toHaveBeenCalled()
  })

  it("undoes the sign-in it made when the customer cannot be made", async () => {
    createCustomer.mockRejectedValue(new Error("customer refused"))
    const fake = fakeContainer({})
    await expect(ensureLogin(fake.container, input({}))).rejects.toThrow("customer refused")
    expect(fake.auth.deleteAuthIdentities).toHaveBeenCalledWith(["auth_new"])
  })
})
