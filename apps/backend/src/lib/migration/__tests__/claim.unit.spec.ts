import { claimToken, readClaimToken } from "../claim"

describe("a moved customer's claim key (F14.5)", () => {
  const now = new Date("2026-11-01T10:00:00Z")

  it("opens its own record until it lapses", () => {
    const token = claimToken("cus_01ABC", now)
    expect(readClaimToken(token, now)).toBe("cus_01ABC")
    expect(readClaimToken(token, new Date(now.getTime() + 59 * 24 * 3600 * 1000))).toBe("cus_01ABC")
    expect(readClaimToken(token, new Date(now.getTime() + 61 * 24 * 3600 * 1000))).toBeNull()
  })

  it("opens nothing once changed", () => {
    const [id, until, signature] = claimToken("cus_01ABC", now).split(".")
    expect(readClaimToken(`cus_01ABD.${until ?? ""}.${signature ?? ""}`, now)).toBeNull()
    expect(
      readClaimToken(`${id ?? ""}.${String(Number(until) + 1)}.${signature ?? ""}`, now)
    ).toBeNull()
    expect(readClaimToken(`${id ?? ""}.${until ?? ""}.${"0".repeat(64)}`, now)).toBeNull()
    expect(readClaimToken("", now)).toBeNull()
    expect(readClaimToken("a.b.c.d", now)).toBeNull()
  })
})
