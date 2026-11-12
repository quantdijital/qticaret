import { Modules } from "@medusajs/framework/utils"
import { CP_INVITABLE_ROLES, CP_STAFF_ROLES } from "../../../lib/staff/roles"
import type { CpStaffRole } from "../../../lib/staff/roles"
import { CP_STAFF_MODULE } from "../../../modules/cp-staff"
import { BOOTSTRAP_INVITE_MS, inviteOfToken } from "../invites"

interface Invite {
  id: string
  email: string
  metadata: Record<string, unknown>
  created_at: Date
}

const invite = (metadata: Record<string, unknown>, createdAt = new Date()): Invite => ({
  id: "invite_1",
  email: "yeni@quant.test",
  metadata,
  created_at: createdAt,
})

/**
 * The container `inviteOfToken` reads: the token's invitation (null for a
 * token that is no good) and the granted roles of the staff (a pending or
 * deactivated member has none, as `roleOf` answers).
 */
function container(found: Invite | null, granted: Record<string, CpStaffRole> = {}) {
  const staff = {
    roleOf: jest.fn((userId: string) => Promise.resolve(granted[userId] ?? null)),
    hasActiveOwner: jest.fn(() =>
      Promise.resolve(Object.values(granted).some((role) => role === "owner"))
    ),
  }
  const users = {
    validateInviteToken: jest.fn(() =>
      found ? Promise.resolve(found) : Promise.reject(new Error("invalid token"))
    ),
  }
  const resolve = (key: string) => {
    if (key === Modules.USER) {
      return users
    }
    if (key === CP_STAFF_MODULE) {
      return staff
    }
    throw new Error(`unexpected ${key}`)
  }
  return { resolve: resolve as never, staff }
}

const refused = (pending: Promise<unknown>) => expect(pending).rejects.toThrow("cp.invite_invalid")

describe("the invitable roles (adr/0061 §3.5, 2026-11-12)", () => {
  it("are every staff role, an owner's too, and no other", () => {
    expect([...CP_INVITABLE_ROLES].sort()).toEqual([...CP_STAFF_ROLES].sort())
  })
})

describe("inviteOfToken: an owner's invitation", () => {
  it("holds while its inviter is a granted, active owner; never a bootstrap one", async () => {
    const { resolve } = container(invite({ role: "owner", invited_by: "user_owner" }), {
      user_owner: "owner",
    })

    await expect(inviteOfToken({ resolve }, "token")).resolves.toEqual({
      id: "invite_1",
      email: "yeni@quant.test",
      role: "owner",
      invited_by: "user_owner",
      bootstrap: false,
    })
  })

  it.each([
    ["no longer staff, deactivated or pending", {}],
    ["now an operator", { user_owner: "operator" }],
    ["a finance member", { user_owner: "finance" }],
  ] as const)("is refused when its inviter is %s", async (_, granted) => {
    const { resolve } = container(invite({ role: "owner", invited_by: "user_owner" }), granted)

    await refused(inviteOfToken({ resolve }, "token"))
  })

  it.each([null, "", 42])("is refused without an inviter (%p)", async (by) => {
    const { resolve } = container(invite({ role: "owner", invited_by: by }), {
      user_other: "owner",
    })

    await refused(inviteOfToken({ resolve }, "token"))
  })

  it("does not ask after the inviter for any other role", async () => {
    const { resolve, staff } = container(invite({ role: "finance", invited_by: "user_gone" }))

    await expect(inviteOfToken({ resolve }, "token")).resolves.toMatchObject({
      role: "finance",
      bootstrap: false,
    })
    expect(staff.roleOf).not.toHaveBeenCalled()
  })
})

describe("inviteOfToken: the bootstrap invitation (unchanged)", () => {
  const bootstrap = (createdAt?: Date) =>
    invite({ role: "owner", invited_by: null, bootstrap: true }, createdAt)

  it("holds within its hour while no owner is granted", async () => {
    const { resolve } = container(bootstrap())

    await expect(inviteOfToken({ resolve }, "token")).resolves.toMatchObject({
      role: "owner",
      invited_by: null,
      bootstrap: true,
    })
  })

  it("is refused past its hour", async () => {
    const { resolve } = container(bootstrap(new Date(Date.now() - BOOTSTRAP_INVITE_MS - 1000)))

    await refused(inviteOfToken({ resolve }, "token"))
  })

  it("is refused once an owner is granted, and is no owner's invitation then", async () => {
    // Even one naming a granted owner as its inviter: a bootstrap one is only ever that
    const { resolve } = container(
      invite({ role: "owner", invited_by: "user_owner", bootstrap: true }),
      { user_owner: "owner" }
    )

    await refused(inviteOfToken({ resolve }, "token"))
  })

  it("is refused for any role but owner", async () => {
    const { resolve } = container(invite({ role: "operator", invited_by: null, bootstrap: true }))

    await refused(inviteOfToken({ resolve }, "token"))
  })

  it.each([false, "true", 1])(
    "is no bootstrap one unless flagged exactly so (%p)",
    async (flag) => {
      const { resolve } = container(invite({ role: "owner", invited_by: null, bootstrap: flag }))

      await refused(inviteOfToken({ resolve }, "token"))
    }
  )
})

describe("inviteOfToken: anything else", () => {
  it.each([
    ["a token that is no good", null],
    ["an unknown role", invite({ role: "emperor", invited_by: "user_owner" })],
    ["no role", invite({ invited_by: "user_owner" })],
  ] as const)("refuses %s", async (_, found) => {
    const { resolve } = container(found, { user_owner: "owner" })

    await refused(inviteOfToken({ resolve }, "token"))
  })
})
