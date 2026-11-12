import { GRANT_REFUSED, grantHolds } from "../grant"
import type { GrantRow } from "../grant"
import CpStaffModuleService from "../service"

const PENDING = new Date(Date.now() + 60_000)

const row = (changes: Partial<GrantRow> = {}): GrantRow => ({
  role: "owner",
  bootstrap: false,
  assigned_by: "user_inviter",
  enrol_by: PENDING,
  enrol_token_hash: null,
  ...changes,
})

describe("grantHolds: an invited owner's first factor (adr/0061 §3.5, 2026-11-12)", () => {
  it("grants while whoever gave the role is a granted owner", () => {
    expect(grantHolds(row(), ["user_inviter"])).toBe(true)
  })

  it.each([
    ["is no longer a granted owner", row(), ["user_other"]],
    ["is gone and no owner is granted", row(), []],
    ["is not named", row({ assigned_by: null }), ["user_other"]],
  ] as const)("refuses when the inviter %s", (_, member, owners) => {
    expect(grantHolds(member, owners)).toBe(false)
  })

  it.each([
    ["a bootstrap owner (its own rule)", row({ bootstrap: true })],
    ["another role", row({ role: "operator" })],
    ["a granted owner", row({ enrol_by: null })],
    ["a reset's re-enrolment", row({ enrol_token_hash: "hash" })],
    ["no member", undefined],
  ] as const)("does not hold %s to it", (_, member) => {
    expect(grantHolds(member, [])).toBe(true)
  })
})

/** The SQL `activate` runs, answered: the granted owners (locked first), then the member. */
function manager(owners: string[], member: GrantRow) {
  const sql: string[] = []
  return {
    sql,
    execute: jest.fn((query: string) => {
      sql.push(query)
      if (query.includes("role = 'owner'")) {
        return Promise.resolve(owners.map((user_id) => ({ user_id })))
      }
      if (query.startsWith("SELECT")) {
        return Promise.resolve([member])
      }
      return Promise.resolve([])
    }),
  }
}

const activate = (tx: ReturnType<typeof manager>) =>
  CpStaffModuleService.prototype.activate.call({}, "user_new", { transactionManager: tx })

describe("activate: decided under the owners' lock", () => {
  it("refuses an invited owner whose inviter is no granted owner, plainly, before any write", async () => {
    const tx = manager(["user_other"], row())

    await expect(activate(tx)).rejects.toThrow(GRANT_REFUSED)
    expect(tx.sql.some((query) => query.startsWith("UPDATE"))).toBe(false)
    // The owners' rows are locked before the member's is read
    expect(tx.sql[0]).toContain("FOR UPDATE")
    expect(tx.sql[0]).toContain("role = 'owner'")
  })

  it("grants an invited owner whose inviter still is one", async () => {
    const tx = manager(["user_inviter"], row())

    await activate(tx)
    expect(
      tx.sql.some((query) => query.startsWith("UPDATE cp_staff_member SET enrol_by = NULL"))
    ).toBe(true)
  })

  it("keeps the bootstrap rule and lets other roles through", async () => {
    const bootstrap = manager(["user_other"], row({ bootstrap: true, assigned_by: null }))
    const operator = manager([], row({ role: "operator", assigned_by: null }))

    await expect(activate(bootstrap)).rejects.toThrow("cp.owner_exists")
    await expect(activate(operator)).resolves.toBeUndefined()
  })
})
