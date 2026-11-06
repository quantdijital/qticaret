import { randomBytes } from "node:crypto"
import { Modules } from "@medusajs/framework/utils"
import { sealEmailChange } from "../../../lib/staff/account"
import { addressInUse, moveLogin, readEmailChange } from "../email-change"

const KEY = randomBytes(32)

/** One staff member and their login, a customer's login, an open invitation. */
function fakeShop() {
  const users = [{ id: "user_1", email: "eski@ornek.com" }]
  const logins = [
    { id: "provid_1", entity_id: "eski@ornek.com" },
    { id: "provid_2", entity_id: "musteri@ornek.com" },
  ]
  const invites = [{ id: "invite_1", email: "davetli@ornek.com" }]
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
    listProviderIdentities: jest.fn((filter: { entity_id: string }) =>
      Promise.resolve(logins.filter((login) => login.entity_id === filter.entity_id))
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
  const container = {
    resolve: (key: string) =>
      key === Modules.AUTH ? auth : key === Modules.USER ? userModule : null,
  } as never
  return { container, users, logins }
}

const linkTo = (to: string, from = "eski@ornek.com") =>
  sealEmailChange({ user_id: "user_1", from, to }, KEY).token

const once = () => {
  const spent = new Set<string>()
  return (nonce: string) => {
    const first = !spent.has(nonce)
    spent.add(nonce)
    return Promise.resolve(first)
  }
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

describe("a confirmation link read", () => {
  it("gives the change and the login to move, once", async () => {
    const { container } = fakeShop()
    const token = linkTo("yeni@ornek.com")
    const spend = once()

    const change = await readEmailChange(container, token, { key: KEY, spend })

    expect(change).toMatchObject({
      user_id: "user_1",
      from: "eski@ornek.com",
      to: "yeni@ornek.com",
      login_id: "provid_1",
    })
    await expect(readEmailChange(container, token, { key: KEY, spend })).rejects.toMatchObject({
      safeMessage: "staff.email_change_invalid",
    })
  })

  it("is refused when it does not open, or the address moved since it was asked", async () => {
    const { container, users } = fakeShop()
    const token = linkTo("yeni@ornek.com")
    await expect(
      readEmailChange(container, token, { key: randomBytes(32), spend: once() })
    ).rejects.toMatchObject({ safeMessage: "staff.email_change_invalid" })

    users[0] = { id: "user_1", email: "baska@ornek.com" }
    await expect(
      readEmailChange(container, token, { key: KEY, spend: once() })
    ).rejects.toMatchObject({ safeMessage: "staff.email_change_invalid" })
  })

  it("is refused when the new address was taken meanwhile, without spending it", async () => {
    const { container } = fakeShop()
    const spend = jest.fn(once())
    await expect(
      readEmailChange(container, linkTo("musteri@ornek.com"), { key: KEY, spend })
    ).rejects.toMatchObject({ safeMessage: "staff.email_unavailable" })
    expect(spend).not.toHaveBeenCalled()
  })
})

describe("the login moved to the new address", () => {
  it("moves, and its undo moves it back", async () => {
    const { container, logins } = fakeShop()

    await moveLogin(container, { login_id: "provid_1", to: "yeni@ornek.com" })
    expect(logins[0]?.entity_id).toBe("yeni@ornek.com")

    await moveLogin(container, { login_id: "provid_1", to: "eski@ornek.com" })
    expect(logins[0]?.entity_id).toBe("eski@ornek.com")
  })
})
