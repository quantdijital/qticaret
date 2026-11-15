import { addressLogin, ensureLogin } from "../steps/account-login"
import type { EnsureLoginInput } from "../steps/account-login"
import { sealPassword } from "../steps/login-password"

const proven = jest.fn<Promise<boolean>, [unknown, string]>()
const createCustomer = jest.fn<Promise<{ result: { id: string } }>, [unknown]>()

jest.mock("../../account/proven-customer", () => ({
  provenCustomer: (container: unknown, id: string) => proven(container, id),
}))
jest.mock("@medusajs/medusa/core-flows", () => ({
  createCustomerAccountWorkflow: () => ({ run: (args: unknown) => createCustomer(args) }),
}))

const EMAIL = "siparis@yilmazticaret.com"
// A password made for the test, not anyone's
const PASSWORD = "Toptan-Yilmaz-2026"

interface Identity {
  id: string
  app_metadata: Record<string, unknown>
}

/** A container whose auth, query, cart and customer modules are plain fakes. */
function fakeContainer(state: {
  customers?: { id: string }[]
  logins?: { auth_identity_id: string; entity_id: string }[]
  identities?: Identity[]
  carts?: { id: string }[]
}) {
  const identities = new Map((state.identities ?? []).map((each) => [each.id, { ...each }]))
  const resolved = <T>(value: T) => jest.fn(() => Promise.resolve(value))
  const auth = {
    register: jest.fn(() => {
      identities.set("auth_new", { id: "auth_new", app_metadata: {} })
      return Promise.resolve({ success: true, authIdentity: { id: "auth_new" } })
    }),
    updateProvider: resolved({ success: true }),
    listProviderIdentities: jest.fn((filters: Record<string, unknown>) =>
      Promise.resolve(
        (state.logins ?? [])
          .filter((login) =>
            typeof filters["auth_identity_id"] === "string"
              ? login.auth_identity_id === filters["auth_identity_id"]
              : true
          )
          .map((login) => ({ ...login, id: `pi_${login.auth_identity_id}`, provider_metadata: {} }))
      )
    ),
    retrieveAuthIdentity: jest.fn((id: string) => Promise.resolve(identities.get(id))),
    updateAuthIdentities: jest.fn((update: Identity) => {
      identities.set(update.id, update)
      return Promise.resolve()
    }),
    updateProviderIdentities: resolved(undefined),
    deleteAuthIdentities: resolved(undefined),
    listAuthVerifications: resolved([]),
    requestAuthVerification: resolved({ code: "code_1" }),
    confirmAuthVerification: resolved(undefined),
  }
  const cart = {
    listCarts: resolved(state.carts ?? []),
    softDeleteCarts: resolved(undefined),
    restoreCarts: resolved(undefined),
  }
  const customer = { deleteCustomers: resolved(undefined) }
  const query = { graph: resolved({ data: state.customers ?? [] }) }
  const modules: Record<string, unknown> = { auth, cart, customer, query }
  return {
    container: { resolve: (key: string) => modules[key] } as never,
    auth,
    cart,
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

beforeEach(() => {
  proven.mockReset()
  createCustomer.mockReset()
  createCustomer.mockResolvedValue({ result: { id: "cus_new" } })
})

describe("who signs in at a new wholesaler's address (ADR-0068 Ek 2026-11-15 (2))", () => {
  it("reads a proven customer, an unconfirmed sign-up, a staff sign-in, or nobody", async () => {
    proven.mockResolvedValue(true)
    expect(
      await addressLogin(fakeContainer({ customers: [{ id: "cus_1" }] }).container, EMAIL)
    ).toEqual({
      kind: "proven",
      customer_id: "cus_1",
    })
    proven.mockResolvedValue(false)
    const squatted = fakeContainer({
      customers: [{ id: "cus_1" }],
      logins: [{ auth_identity_id: "auth_1", entity_id: EMAIL }],
      identities: [{ id: "auth_1", app_metadata: { customer_id: "cus_1" } }],
    })
    expect(await addressLogin(squatted.container, EMAIL)).toEqual({
      kind: "unproven",
      customer_id: "cus_1",
      identity_id: "auth_1",
    })
    const staff = fakeContainer({
      logins: [{ auth_identity_id: "auth_9", entity_id: EMAIL }],
      identities: [{ id: "auth_9", app_metadata: { user_id: "user_1" } }],
    })
    expect(await addressLogin(staff.container, EMAIL)).toEqual({ kind: "staff" })
    expect(await addressLogin(fakeContainer({}).container, EMAIL)).toEqual({ kind: "none" })
  })
})

describe("the wholesaler's sign-in as staff set it", () => {
  it("case 1: no one at the address: a sign-in with staff's password and a customer, confirmed", async () => {
    const fake = fakeContainer({})
    const { result, undo } = await ensureLogin(fake.container, input({}))
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
    expect(undo).toMatchObject({ identity_made: "auth_new", customer_made: "cus_new" })
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
    const fake = fakeContainer({})
    const login = { kind: "unproven" as const, customer_id: "cus_1", identity_id: "auth_1" }
    await expect(ensureLogin(fake.container, input({ login }))).rejects.toThrow(
      "wholesale.unproven_signup"
    )
    expect(fake.auth.updateProvider).not.toHaveBeenCalled()
    expect(fake.cart.softDeleteCarts).not.toHaveBeenCalled()
  })

  it("case 3, taken over: the password replaced, older sign-ins ended, its carts set aside", async () => {
    const fake = fakeContainer({
      logins: [{ auth_identity_id: "auth_1", entity_id: EMAIL }],
      identities: [{ id: "auth_1", app_metadata: { customer_id: "cus_1" } }],
      carts: [{ id: "cart_1" }],
    })
    const login = { kind: "unproven" as const, customer_id: "cus_1", identity_id: "auth_1" }
    const { result } = await ensureLogin(fake.container, input({ login, take_over: true }))
    expect(result).toEqual({ customer_id: "cus_1", password: "replaced" })
    expect(fake.auth.updateProvider).toHaveBeenCalledWith("emailpass", {
      entity_id: EMAIL,
      password: PASSWORD,
    })
    const metadata = fake.identities.get("auth_1")?.app_metadata
    expect(metadata?.["customer_id"]).toBe("cus_1")
    expect(typeof metadata?.["password_changed_at"]).toBe("string")
    expect(fake.cart.softDeleteCarts).toHaveBeenCalledWith(["cart_1"])
    expect(fake.auth.register).not.toHaveBeenCalled()
    expect(createCustomer).not.toHaveBeenCalled()
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
