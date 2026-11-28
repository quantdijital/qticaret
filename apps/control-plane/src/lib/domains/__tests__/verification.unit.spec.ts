import {
  LOST_GRACE_MS,
  PENDING_MAX_AGE_MS,
  PENDING_MAX_GAP_MS,
  PROVED_GAP_MS,
  dnsInstructions,
  isApex,
  newVerificationToken,
  nextCheckState,
  parseRoutingTarget,
  pendingGap,
  txtNameOf,
  txtValueOf,
} from "../verification"
import type { CheckState } from "../verification"

const NOW = new Date("2026-11-28T12:00:00Z")
const MINUTE = 60_000

const state = (changes: Partial<CheckState> = {}): CheckState => ({
  verification: "pending",
  verification_error: null,
  verified_at: null,
  txt_lost_since: null,
  check_attempts: 0,
  created_at: new Date(NOW.getTime() - 10 * MINUTE),
  ...changes,
})

describe("a custom domain's proof (F16.7)", () => {
  it("makes an unguessable token and the TXT record that carries it", () => {
    const token = newVerificationToken()

    expect(token).toMatch(/^[0-9a-f]{32}$/)
    expect(newVerificationToken()).not.toBe(token)
    expect(txtNameOf("www.atolye.com.tr")).toBe("_qticaret-verify.www.atolye.com.tr")
    expect(txtValueOf(token)).toBe(`qticaret-verify=${token}`)
  })

  it("reads the routing target, refusing what is not a host or an address", () => {
    expect(parseRoutingTarget(" Edge.QuantTicaret.com. ", "203.0.113.7, 2001:db8::1")).toEqual({
      cname: "edge.quantticaret.com",
      addresses: ["203.0.113.7", "2001:db8::1"],
    })
    expect(parseRoutingTarget(undefined, undefined)).toEqual({ cname: null, addresses: [] })
    expect(() => parseRoutingTarget("http://edge.example.com")).toThrow()
    expect(() => parseRoutingTarget(undefined, "edge.example.com")).toThrow()
  })

  it("tells a subdomain to CNAME, an apex to A records, and nothing before the server exists", () => {
    const target = { cname: "edge.quantticaret.com", addresses: ["203.0.113.7"] }

    expect(dnsInstructions("www.atolye.com.tr", "t1", target)).toEqual({
      txt: { name: "_qticaret-verify.www.atolye.com.tr", value: "qticaret-verify=t1" },
      routing: { type: "CNAME", name: "www.atolye.com.tr", values: ["edge.quantticaret.com"] },
    })
    expect(dnsInstructions("atolye.com", "t1", target).routing).toEqual({
      type: "A",
      name: "atolye.com",
      values: ["203.0.113.7"],
    })
    expect(
      dnsInstructions("atolye.com", "t1", { cname: "edge.quantticaret.com", addresses: [] }).routing
    ).toMatchObject({ type: "CNAME" })
    expect(dnsInstructions("atolye.com", "t1", { cname: null, addresses: [] }).routing).toBeNull()
  })

  it("knows a Turkish registered name is an apex, its www is not", () => {
    expect(isApex("atolye.com.tr")).toBe(true)
    expect(isApex("www.atolye.com.tr")).toBe(false)
    expect(isApex("atolye.com")).toBe(true)
    expect(isApex("magaza.atolye.com")).toBe(false)
    expect(
      dnsInstructions("atolye.com.tr", "t1", {
        cname: "edge.example.net",
        addresses: ["203.0.113.7"],
      }).routing?.type
    ).toBe("A")
  })
})

describe("a check's next state (F16.7)", () => {
  it("proves a pending domain, active only once it points at the platform", () => {
    const verified = nextCheckState(state(), { txt: "match", routing: "unknown" }, NOW)
    const active = nextCheckState(state(), { txt: "match", routing: "match" }, NOW)
    const elsewhere = nextCheckState(state(), { txt: "match", routing: "mismatch" }, NOW)

    expect(verified).toMatchObject({
      verification: "verified",
      verification_error: null,
      verified_at: NOW,
      check_attempts: 1,
      next_check_at: new Date(NOW.getTime() + PROVED_GAP_MS),
    })
    expect(active).toMatchObject({ verification: "active", verification_error: null })
    expect(elsewhere).toMatchObject({
      verification: "verified",
      verification_error: "routing_mismatch",
    })
  })

  it("keeps a pending domain pending with the reason, checked again on a growing gap", () => {
    const missing = nextCheckState(state(), { txt: "missing", routing: "unknown" }, NOW)
    const other = nextCheckState(
      state({ check_attempts: 3 }),
      { txt: "mismatch", routing: "unknown" },
      NOW
    )
    const silent = nextCheckState(state(), { txt: "unavailable", routing: "unavailable" }, NOW)

    expect(missing).toMatchObject({
      verification: "pending",
      verification_error: "txt_missing",
      next_check_at: new Date(NOW.getTime() + MINUTE),
    })
    expect(other).toMatchObject({
      verification_error: "txt_mismatch",
      next_check_at: new Date(NOW.getTime() + 8 * MINUTE),
    })
    expect(silent).toMatchObject({ verification: "pending", verification_error: "dns_unavailable" })
    expect(pendingGap(1)).toBe(MINUTE)
    expect(pendingGap(40)).toBe(PENDING_MAX_GAP_MS)
  })

  it("fails a domain unproved after its week; a manual check does not fail it but may prove it", () => {
    const old = state({ created_at: new Date(NOW.getTime() - PENDING_MAX_AGE_MS) })

    expect(nextCheckState(old, { txt: "missing", routing: "unknown" }, NOW)).toMatchObject({
      verification: "failed",
      verification_error: "expired",
      next_check_at: null,
    })
    expect(
      nextCheckState(old, { txt: "missing", routing: "unknown" }, NOW, { manual: true })
    ).toMatchObject({ verification: "pending" })
    const failed = state({ verification: "failed", verification_error: "expired" })
    expect(nextCheckState(failed, { txt: "mismatch", routing: "unknown" }, NOW)).toMatchObject({
      verification: "failed",
      verification_error: "txt_mismatch",
      next_check_at: null,
    })
    expect(nextCheckState(failed, { txt: "match", routing: "unknown" }, NOW)).toMatchObject({
      verification: "verified",
    })
  })

  it("never takes a proved domain away: a lost proof is a warning, DNS silence keeps active", () => {
    const at = new Date("2026-11-20T00:00:00Z")
    const active = state({ verification: "active", verified_at: at })

    expect(nextCheckState(active, { txt: "missing", routing: "match" }, NOW)).toMatchObject({
      verification: "active",
      verification_error: "txt_lost",
      verified_at: at,
    })
    expect(nextCheckState(active, { txt: "match", routing: "unavailable" }, NOW)).toMatchObject({
      verification: "active",
      verified_at: at,
    })
    expect(nextCheckState(active, { txt: "match", routing: "missing" }, NOW)).toMatchObject({
      verification: "verified",
      verification_error: "routing_missing",
    })
  })

  it("takes a proved domain back after two weeks without its proof and not pointing here", () => {
    const at = new Date("2026-11-01T00:00:00Z")
    const lostAt = new Date(NOW.getTime() - LOST_GRACE_MS)
    const active = state({ verification: "active", verified_at: at })

    // First sight of the loss: noted, nothing taken
    expect(nextCheckState(active, { txt: "missing", routing: "mismatch" }, NOW)).toMatchObject({
      verification: "active",
      txt_lost_since: NOW,
    })
    const lost = state({ verification: "verified", verified_at: at, txt_lost_since: lostAt })
    expect(nextCheckState(lost, { txt: "missing", routing: "mismatch" }, NOW)).toMatchObject({
      verification: "failed",
      verification_error: "txt_lost",
      verified_at: null,
      next_check_at: null,
    })
    // Still pointing at the platform, or DNS silent: kept
    expect(nextCheckState(lost, { txt: "missing", routing: "match" }, NOW).verification).toBe(
      "verified"
    )
    expect(nextCheckState(lost, { txt: "unavailable", routing: "unavailable" }, NOW)).toMatchObject(
      { verification: "verified", txt_lost_since: lostAt }
    )
    // The proof back: the clock is cleared
    expect(
      nextCheckState(lost, { txt: "match", routing: "unknown" }, NOW).txt_lost_since
    ).toBeNull()
  })
})
