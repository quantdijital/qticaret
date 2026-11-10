import { randomBytes } from "node:crypto"
import { STEP_UP_TTL_MS, checkStepUpProof, issueStepUpProof, stepUpKey } from "../step-up"

const key = stepUpKey(randomBytes(32))
const BINDING = "user_1\nauthid_1\nsess_1"
const NOW = 1_800_000_000_000

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
    const flipped = `${token.slice(0, -2)}${token.endsWith("A") ? "B" : "A"}${token.slice(-1)}`

    expect(checkStepUpProof(flipped, BINDING, key, NOW)).toBe("invalid")
    expect(checkStepUpProof("", BINDING, key, NOW)).toBe("invalid")
    expect(checkStepUpProof("not a token!", BINDING, key, NOW)).toBe("invalid")
    expect(checkStepUpProof("A".repeat(600), BINDING, key, NOW)).toBe("invalid")
  })

  it("gives a new token every time", () => {
    expect(issueStepUpProof(BINDING, key, NOW).token).not.toBe(
      issueStepUpProof(BINDING, key, NOW).token
    )
  })
})
