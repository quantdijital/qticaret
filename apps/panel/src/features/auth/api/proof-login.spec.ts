import { afterEach, describe, expect, it, vi } from "vitest"
import { signInWithProof } from "./proof-login"

vi.mock("@/lib/challenge", () => ({
  solveChallenge: vi.fn(() => Promise.resolve("7")),
  challengeHeader: (token: string, nonce: string) => ({ "x-challenge": `${token}.${nonce}` }),
}))
const session = vi.fn(() => Promise.resolve({}))
vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: () => session() } } }))

const challenge = { token: "tok", salt: "salt", bits: 18, expires_at: "2026-11-02T00:00:00Z" }
const answer = (status: number, body: Record<string, unknown>) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))

describe("signInWithProof", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    session.mockClear()
  })

  it("solves another round when the answered request crosses into a harder challenge", async () => {
    const fetch = vi
      .fn()
      .mockReturnValueOnce(answer(428, { challenge }))
      .mockReturnValueOnce(answer(428, { challenge: { ...challenge, bits: 20 } }))
      .mockReturnValueOnce(answer(200, { token: "jwt" }))
    vi.stubGlobal("fetch", fetch)

    await expect(signInWithProof({ email: "a@b.example", password: "x" })).resolves.toBeNull()
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(session).toHaveBeenCalledTimes(1)
  })

  it("gives up after a few rounds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => answer(428, { challenge, message: "fraud.challenge_required" }))
    )
    await expect(signInWithProof({ email: "a@b.example", password: "x" })).rejects.toMatchObject({
      status: 428,
    })
    expect(session).not.toHaveBeenCalled()
  })
})
