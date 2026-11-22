import { e2eAdminExit } from "../remove-e2e-admin"

const row = (user_id: string, role: string) => ({ id: `strole_${user_id}`, user_id, role })

describe("how the panel e2e run's admin leaves", () => {
  it("leaves as any member on a shop with an owner of its own", () => {
    expect(e2eAdminExit([row("e2e", "owner"), row("sahip", "owner")], "e2e")).toBe("member")
    expect(e2eAdminExit([row("e2e", "admin"), row("sahip", "owner")], "e2e")).toBe("member")
  })

  it("takes its own role first when it is the shop's only staff (CI's fresh database)", () => {
    expect(e2eAdminExit([row("e2e", "owner")], "e2e")).toBe("sole")
  })

  it("never leaves other staff without an owner", () => {
    expect(e2eAdminExit([row("e2e", "owner"), row("operations", "operations")], "e2e")).toBe(
      "refuse"
    )
  })

  it("leaves as a member when it holds no role at all", () => {
    expect(e2eAdminExit([], "e2e")).toBe("member")
  })
})
