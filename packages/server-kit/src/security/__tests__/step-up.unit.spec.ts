import { randomBytes } from "node:crypto"
import { STEP_UP_TTL_MS, checkStepUpProof, issueStepUpProof, stepUpKey } from "../step-up"

const key = stepUpKey(randomBytes(32))
const BINDING = "user_1\nauthid_1\nsess_1"
const NOW = 1_800_000_000_000
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"

/** `token` with the lowest bit of character `at` flipped: always another character. */
const flip = (token: string, at: number) =>
  `${token.slice(0, at)}${ALPHABET.charAt(ALPHABET.indexOf(token.charAt(at)) ^ 1)}${token.slice(at + 1)}`

describe("step-up proofs", () => {
  it("holds for its binding until it runs out", () => {
    const { token, expiresAt } = issueStepUpProof(BINDING, key, NOW)

    expect(expiresAt).toBe(NOW + STEP_UP_TTL_MS)
    expect(checkStepUpProof(token, BINDING, key, NOW + 1)).toBe("valid")
    expect(checkStepUpProof(token, BINDING, key, expiresAt - 1)).toBe("valid")
    expect(checkStepUpProof(token, BINDING, key, expiresAt)).toBe("expired")
  })

  it("opens for no other person or session", () => {
    const { token } = issueStepUpProof(BINDING, key, NOW)

    expect(checkStepUpProof(token, "user_2\nauthid_1\nsess_1", key, NOW)).toBe("invalid")
    expect(checkStepUpProof(token, "user_1\nauthid_1\nsess_2", key, NOW)).toBe("invalid")
  })

  it("opens under no other key, and the derived key is not the app key", () => {
    const appKey = randomBytes(32)
    const { token } = issueStepUpProof(BINDING, stepUpKey(appKey), NOW)

    expect(stepUpKey(appKey).equals(appKey)).toBe(false)
    expect(checkStepUpProof(token, BINDING, appKey, NOW)).toBe("invalid")
    expect(checkStepUpProof(token, BINDING, stepUpKey(appKey), NOW)).toBe("valid")
  })

  it("refuses tampered, malformed and oversized tokens without throwing", () => {
    const { token } = issueStepUpProof(BINDING, key, NOW)
    // base64url of iv (12 bytes) | tag (16) | ciphertext: character 20 lies in the tag,
    // character 60 in the ciphertext; each a whole six bits, so a byte always changes
    for (const at of [20, 60]) {
      const flipped = flip(token, at)
      expect(flipped).not.toBe(token)
      expect(Buffer.from(flipped, "base64url").equals(Buffer.from(token, "base64url"))).toBe(false)
      expect(checkStepUpProof(flipped, BINDING, key, NOW)).toBe("invalid")
    }
    expect(checkStepUpProof("", BINDING, key, NOW)).toBe("invalid")
    expect(checkStepUpProof("not a token!", BINDING, key, NOW)).toBe("invalid")
    expect(checkStepUpProof("A".repeat(600), BINDING, key, NOW)).toBe("invalid")
  })

  it("holds in one spelling only: the last character's unused bits set open nothing", () => {
    const { token } = issueStepUpProof(BINDING, key, NOW)
    // 70 sealed bytes are 94 characters: the last one carries 2 bits, its low 4 unused
    expect(token).toHaveLength(94)
    const respelled = flip(token, token.length - 1)

    expect(Buffer.from(respelled, "base64url").equals(Buffer.from(token, "base64url"))).toBe(true)
    expect(checkStepUpProof(respelled, BINDING, key, NOW)).toBe("invalid")
    expect(checkStepUpProof(`${token}A`, BINDING, key, NOW)).toBe("invalid")
    expect(checkStepUpProof(token, BINDING, key, NOW)).toBe("valid")
  })

  it("gives a new token every time", () => {
    expect(issueStepUpProof(BINDING, key, NOW).token).not.toBe(
      issueStepUpProof(BINDING, key, NOW).token
    )
  })
})
