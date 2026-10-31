import { createHash, randomBytes } from "node:crypto"
import { checkChallenge, issueChallenge, solveChallenge, solves } from ".."

// A throwaway key for these checks only
const KEY = randomBytes(32)
const NOW = Date.UTC(2026, 9, 31, 4, 0, 0)

const solved = (bits = 10, scope: "register" | "login" = "register") => {
  const challenge = issueChallenge(scope, KEY, bits, NOW)
  return {
    challenge,
    header: `${challenge.token}.${solveChallenge(challenge.salt, challenge.bits)}`,
  }
}

describe("proof-of-work challenge", () => {
  it("takes a solved challenge once per salt, for its own scope, until it lapses", () => {
    const { challenge, header } = solved()
    const check = checkChallenge(header, "register", KEY, NOW + 1000)

    expect(check).toMatchObject({ ok: true, until: NOW + 5 * 60 * 1000 })
    expect(checkChallenge(header, "login", KEY, NOW)).toEqual({ ok: false, reason: "scope" })
    expect(checkChallenge(header, "register", KEY, NOW + 5 * 60 * 1000 + 1)).toEqual({
      ok: false,
      reason: "expired",
    })
    expect(challenge.expires_at).toBe(new Date(NOW + 5 * 60 * 1000).toISOString())
    // The same salt gives the same single-use key, another salt another
    const again = checkChallenge(header, "register", KEY, NOW)
    const other = checkChallenge(solved().header, "register", KEY, NOW)
    expect(again.ok && check.ok && again.key === check.key).toBe(true)
    expect(other.ok && check.ok && other.key !== check.key).toBe(true)
  })

  it("refuses an unsolved, a forged and a malformed answer", () => {
    const { challenge, header } = solved()
    // The next nonce that does not solve it (one in 1,024 would)
    let bad = Number(header.split(".").pop()) + 1
    while (solves(challenge.salt, String(bad), challenge.bits)) {
      bad++
    }
    const wrongNonce = `${challenge.token}.${String(bad)}`
    // The token claims 11 bits where it was signed for 10
    const easier = header.replace(".10.", ".11.")

    expect(checkChallenge(wrongNonce, "register", KEY, NOW)).toEqual({
      ok: false,
      reason: "unsolved",
    })
    expect(checkChallenge(easier, "register", KEY, NOW)).toEqual({ ok: false, reason: "forged" })
    expect(checkChallenge(header, "register", randomBytes(32), NOW)).toEqual({
      ok: false,
      reason: "forged",
    })
    expect(checkChallenge(`${challenge.token}.x1`, "register", KEY, NOW)).toEqual({
      ok: false,
      reason: "malformed",
    })
    expect(checkChallenge("a.b.c", "register", KEY, NOW)).toEqual({
      ok: false,
      reason: "malformed",
    })
  })

  it("holds the difficulty to its bounds", () => {
    expect(issueChallenge("login", KEY, 2, NOW).bits).toBe(10)
    expect(issueChallenge("login", KEY, 40, NOW).bits).toBe(24)
  })

  it("counts leading zero bits of the digest exactly", () => {
    const salt = "a".repeat(22)
    const nonce = solveChallenge(salt, 12)
    const digest = createHash("sha256").update(`${salt}${nonce}`).digest()

    expect(digest[0]).toBe(0)
    expect((digest[1] ?? 0xff) >> 4).toBe(0)
    expect(solves(salt, nonce, 12)).toBe(true)
    expect(solves(salt, nonce, 0)).toBe(true)
  })
})
