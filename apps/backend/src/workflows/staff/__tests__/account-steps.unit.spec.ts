import { Modules } from "@medusajs/framework/utils"
import {
  checkNewPassword,
  notePasswordChanged,
  provePassword,
  restorePassword,
  setPassword,
} from "../account-steps"

interface Login {
  id: string
  entity_id: string
  provider_metadata: Record<string, unknown>
}

/** The user and auth modules as the steps use them, over one user and their login. */
function fakeShop(options: { mfa?: boolean } = {}) {
  const login: Login = {
    id: "provid_1",
    entity_id: "elif@ornek.com",
    provider_metadata: { password: "eski-özet" },
  }
  const identity = {
    id: "authid_1",
    app_metadata: { user_id: "user_1" } as Record<string, unknown>,
  }
  const password = { value: "Doğru-şifre-2026" }
  const auth = {
    authenticate: jest.fn(
      (_provider: string, input: { body: { email: string; password: string } }) => {
        const right = input.body.email === login.entity_id && input.body.password === password.value
        if (!right) {
          return Promise.resolve({ success: false, error: "Invalid email or password" })
        }
        return Promise.resolve(
          options.mfa
            ? { success: false, mfaChallenge: { id: "mfach_1", auth_identity_id: identity.id } }
            : { success: true, authIdentity: { id: identity.id } }
        )
      }
    ),
    listProviderIdentities: jest.fn((filter: { entity_id: string }) =>
      Promise.resolve(filter.entity_id === login.entity_id ? [{ ...login }] : [])
    ),
    updateProvider: jest.fn((_provider: string, data: { entity_id: string; password: string }) => {
      password.value = data.password
      login.provider_metadata = { password: `özet:${data.password}` }
      return Promise.resolve({ success: true })
    }),
    updateProviderIdentities: jest.fn(
      (rows: { id: string; provider_metadata?: Record<string, unknown> }[]) => {
        for (const row of rows) {
          if (row.id === login.id && row.provider_metadata) {
            login.provider_metadata = row.provider_metadata
          }
        }
        return Promise.resolve(rows)
      }
    ),
    retrieveAuthIdentity: jest.fn(() => Promise.resolve({ ...identity })),
    updateAuthIdentities: jest.fn((row: { app_metadata: Record<string, unknown> }) => {
      identity.app_metadata = row.app_metadata
      return Promise.resolve(row)
    }),
  }
  const users = {
    listUsers: jest.fn((filter: { id?: string }) =>
      Promise.resolve(filter.id === "user_1" ? [{ id: "user_1", email: login.entity_id }] : [])
    ),
  }
  const container = {
    resolve: (key: string) => (key === Modules.AUTH ? auth : key === Modules.USER ? users : null),
  } as never
  return { container, auth, login, identity, password }
}

describe("proving one's own password", () => {
  it("gives the login's address and identity for the right password", async () => {
    const { container } = fakeShop()
    await expect(
      provePassword(container, { user_id: "user_1", password: "Doğru-şifre-2026" })
    ).resolves.toEqual({ email: "elif@ornek.com", auth_identity_id: "authid_1" })
  })

  it("takes the 2FA challenge as the right password's answer", async () => {
    const { container } = fakeShop({ mfa: true })
    await expect(
      provePassword(container, { user_id: "user_1", password: "Doğru-şifre-2026" })
    ).resolves.toEqual({ email: "elif@ornek.com", auth_identity_id: "authid_1" })
  })

  it("refuses a wrong password and an unknown user alike", async () => {
    const { container } = fakeShop({ mfa: true })
    await expect(
      provePassword(container, { user_id: "user_1", password: "yanlis-sifre-123" })
    ).rejects.toMatchObject({ safeMessage: "staff.password_wrong" })
    await expect(
      provePassword(container, { user_id: "user_2", password: "Doğru-şifre-2026" })
    ).rejects.toMatchObject({ safeMessage: "staff.password_wrong" })
  })
})

describe("a new password", () => {
  it("follows the platform's rule and differs from the current one", async () => {
    const base = { email: "elif@ornek.com", current: "Doğru-şifre-2026" }
    await expect(checkNewPassword({ ...base, next: "kısa" })).rejects.toMatchObject({
      safeMessage: "auth.password_too_short",
    })
    await expect(checkNewPassword({ ...base, next: "elif-2026-panel" })).rejects.toMatchObject({
      safeMessage: "auth.password_contains_email",
    })
    await expect(checkNewPassword({ ...base, next: base.current })).rejects.toMatchObject({
      safeMessage: "staff.password_same",
    })
    await expect(
      checkNewPassword({ ...base, next: "yeni ve uzun bir parola" })
    ).resolves.toBeUndefined()
  })

  it("is set on the login, and undone to the old hash", async () => {
    const { container, auth, login } = fakeShop()

    const undo = await setPassword(container, {
      email: login.entity_id,
      password: "yeni ve uzun bir parola",
    })
    expect(auth.updateProvider).toHaveBeenCalledWith("emailpass", {
      entity_id: "elif@ornek.com",
      password: "yeni ve uzun bir parola",
    })
    expect(login.provider_metadata).toEqual({ password: "özet:yeni ve uzun bir parola" })

    await restorePassword(container, undo)
    expect(login.provider_metadata).toEqual({ password: "eski-özet" })
  })

  it("fails when the provider does not take it, and when there is no login", async () => {
    const { container, auth } = fakeShop()
    auth.updateProvider.mockResolvedValueOnce({ success: false })
    await expect(
      setPassword(container, { email: "elif@ornek.com", password: "yeni ve uzun bir parola" })
    ).rejects.toThrow("staff.password_not_set")
    await expect(
      setPassword(container, { email: "baska@ornek.com", password: "yeni ve uzun bir parola" })
    ).rejects.toMatchObject({ safeMessage: "staff.password_wrong" })
  })

  it("notes when it changed beside what the identity held, and gives that back to undo", async () => {
    const { container, identity } = fakeShop()
    const at = new Date("2026-11-06T09:00:00.000Z")

    const before = await notePasswordChanged(container, "authid_1", at)

    expect(before).toEqual({ user_id: "user_1" })
    expect(identity.app_metadata).toEqual({
      user_id: "user_1",
      password_changed_at: "2026-11-06T09:00:00.000Z",
    })
  })
})
