import { Modules } from "@medusajs/framework/utils"
import { newEmailChange } from "../../../lib/staff/account"
import type { EmailChangeClaim } from "../../../lib/staff/account"
import { createMemoryAccountStore } from "../../../lib/staff/account-store"
import { STAFF_ROLES_MODULE } from "../../../modules/staff-roles"
import {
  addressInUse,
  cancelEmailChange,
  moveLogin,
  pendingEmailChange,
  readEmailChange,
} from "../email-change"

/** One staff member and their login, a customer's login, an open invitation. */
function fakeShop() {
  const users = [{ id: "user_1", email: "eski@ornek.com" }]
  const logins = [
    { id: "provid_1", entity_id: "eski@ornek.com" },
    { id: "provid_2", entity_id: "musteri@ornek.com" },
  ]
  const invites = [{ id: "invite_1", email: "davetli@ornek.com" }]
  const roles = new Map<string, string>([["user_1", "operations"]])
  const userModule = {
    listUsers: jest.fn((filter: { id?: string; email?: string }) =>
      Promise.resolve(
        users.filter(
          (user) =>
            (filter.id === undefined || user.id === filter.id) &&
            (filter.email === undefined || user.email === filter.email)
        )
      )
    ),
    listInvites: jest.fn((filter: { email: string }) =>
      Promise.resolve(invites.filter((invite) => invite.email === filter.email))
    ),
  }
  const auth = {
    listProviderIdentities: jest.fn((filter: { id?: string[]; entity_id?: string }) =>
      Promise.resolve(
        logins.filter(
          (login) =>
            (filter.id === undefined || filter.id.includes(login.id)) &&
            (filter.entity_id === undefined || login.entity_id === filter.entity_id)
        )
      )
    ),
    updateProviderIdentities: jest.fn((rows: { id: string; entity_id: string }[]) => {
      for (const row of rows) {
        const login = logins.find((each) => each.id === row.id)
        if (login) {
          login.entity_id = row.entity_id
        }
      }
      return Promise.resolve(rows)
    }),
  }
  const staffRoles = { roleOf: (id: string) => Promise.resolve(roles.get(id) ?? null) }
  const container = {
    resolve: (key: string) =>
      key === Modules.AUTH
        ? auth
        : key === Modules.USER
          ? userModule
          : key === STAFF_ROLES_MODULE
            ? staffRoles
            : null,
  } as never
  return { container, users, logins, roles, store: createMemoryAccountStore() }
}

/** An ask as the request makes it: the change waiting, its claim for the link. */
async function ask(
  store: ReturnType<typeof createMemoryAccountStore>,
  to: string
): Promise<EmailChangeClaim> {
  const claim = newEmailChange({ user_id: "user_1", from: "eski@ornek.com", to })
  await store.setPending("user_1", JSON.stringify(claim), 60_000)
  return claim
}

describe("whether an address is free for a staff member", () => {
  it("is taken by another user, an open invitation or any login, never by oneself", async () => {
    const { container } = fakeShop()
    await expect(addressInUse(container, "eski@ornek.com", "user_2")).resolves.toBe(true)
    await expect(addressInUse(container, "davetli@ornek.com", "user_1")).resolves.toBe(true)
    await expect(addressInUse(container, "musteri@ornek.com", "user_1")).resolves.toBe(true)
    await expect(addressInUse(container, "yeni@ornek.com", "user_1")).resolves.toBe(false)
  })
})

describe("a confirmation read", () => {
  it("gives the change and the login to move, once", async () => {
    const { container, store } = fakeShop()
    const claim = await ask(store, "yeni@ornek.com")

    const change = await readEmailChange(container, { user_id: "user_1", claim }, store)

    expect(change).toMatchObject({ to: "yeni@ornek.com", login_id: "provid_1" })
    await expect(
      readEmailChange(container, { user_id: "user_1", claim }, store)
    ).rejects.toMatchObject({ safeMessage: "staff.email_change_invalid" })
  })

  it("takes only the latest ask: an older link opens nothing", async () => {
    const { container, store } = fakeShop()
    const older = await ask(store, "ilk@ornek.com")
    const latest = await ask(store, "son@ornek.com")

    await expect(
      readEmailChange(container, { user_id: "user_1", claim: older }, store)
    ).rejects.toMatchObject({ safeMessage: "staff.email_change_invalid" })
    await expect(
      readEmailChange(container, { user_id: "user_1", claim: latest }, store)
    ).resolves.toMatchObject({ to: "son@ornek.com" })
  })

  it("is refused for another member, after a cancel, without a role, or moved since", async () => {
    const { container, store, users, roles } = fakeShop()
    const claim = await ask(store, "yeni@ornek.com")
    const refused = (userId = "user_1") =>
      expect(readEmailChange(container, { user_id: userId, claim }, store)).rejects.toMatchObject({
        safeMessage: "staff.email_change_invalid",
      })

    await refused("user_2")
    roles.delete("user_1")
    await refused()
    roles.set("user_1", "readonly")
    users[0] = { id: "user_1", email: "baska@ornek.com" }
    await refused()
    users[0] = { id: "user_1", email: "eski@ornek.com" }
    await expect(cancelEmailChange("user_1", store)).resolves.toBe(true)
    await expect(pendingEmailChange("user_1", store)).resolves.toBeNull()
    await refused()
  })

  it("is refused when the new address was taken meanwhile, the change still waiting", async () => {
    const { container, store } = fakeShop()
    const claim = await ask(store, "musteri@ornek.com")
    await expect(
      readEmailChange(container, { user_id: "user_1", claim }, store)
    ).rejects.toMatchObject({ safeMessage: "staff.email_unavailable" })
    await expect(pendingEmailChange("user_1", store)).resolves.toMatchObject({
      nonce: claim.nonce,
    })
  })
})

describe("the login moved to the new address", () => {
  it("moves from the asked address only, and its undo moves it back", async () => {
    const { container, logins } = fakeShop()

    await moveLogin(container, {
      login_id: "provid_1",
      from: "eski@ornek.com",
      to: "yeni@ornek.com",
    })
    expect(logins[0]?.entity_id).toBe("yeni@ornek.com")
    // A second confirmation that lost the race finds the login moved already
    await expect(
      moveLogin(container, { login_id: "provid_1", from: "eski@ornek.com", to: "baska@ornek.com" })
    ).rejects.toMatchObject({ safeMessage: "staff.email_change_invalid" })

    await moveLogin(container, {
      login_id: "provid_1",
      from: "yeni@ornek.com",
      to: "eski@ornek.com",
    })
    expect(logins[0]?.entity_id).toBe("eski@ornek.com")
  })
})
