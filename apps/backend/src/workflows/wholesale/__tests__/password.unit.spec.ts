import { customerLogins } from "../accounts/password"

function fakeContainer(identities: Record<string, Record<string, unknown>>) {
  const logins = Object.keys(identities).map((id, index) => ({
    id: `pi_${id}`,
    entity_id: index === 0 ? "Victim@example.com" : "victim@example.com",
    auth_identity_id: id,
    provider_metadata: {},
  }))
  const modules: Record<string, unknown> = {
    query: {
      graph: () => Promise.resolve({ data: [{ id: "cus_1", email: "victim@example.com" }] }),
    },
    auth: {
      listProviderIdentities: () => Promise.resolve(logins),
      retrieveAuthIdentity: (id: string) =>
        Promise.resolve({ id, app_metadata: identities[id] ?? {} }),
    },
  }
  return { resolve: (key: string) => modules[key] } as never
}

describe("a wholesaler's new password reaches every sign-in at the address (review M2, M3)", () => {
  it("finds every case variant of the address, and the one tied to the customer", async () => {
    const found = await customerLogins(
      fakeContainer({ auth_1: {}, auth_2: { customer_id: "cus_1" } }),
      "cus_1"
    )
    expect(found?.logins.map((login) => login.entity_id)).toEqual([
      "Victim@example.com",
      "victim@example.com",
    ])
    expect(found?.own.identity_id).toBe("auth_2")
  })

  it("refuses a staff member's sign-in, even one tied to the customer", async () => {
    await expect(
      customerLogins(
        fakeContainer({ auth_1: { customer_id: "cus_1", user_id: "user_1" } }),
        "cus_1"
      )
    ).rejects.toThrow("wholesale.login_in_use")
  })

  it("refuses a sign-in tied to another customer, and says when none is theirs", async () => {
    await expect(
      customerLogins(fakeContainer({ auth_1: { customer_id: "cus_2" } }), "cus_1")
    ).rejects.toThrow("wholesale.login_in_use")
    expect(await customerLogins(fakeContainer({ auth_1: {} }), "cus_1")).toBeNull()
  })
})
