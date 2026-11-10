import { createMemoryStore } from "../../rate-limit/store"
import {
  PROOF_BURST,
  SCOPED_PROOF_CEILING,
  countScopedWrongProof,
  countWrongProof,
  firstCodeUse,
  proofBurstExceeded,
  proofsLocked,
  scopedProofsLocked,
} from "../proofs"

let now = 0
const store = createMemoryStore(() => now)

beforeEach(() => {
  // Every window of the last test over
  now += 2 * 24 * 60 * 60 * 1000
})

describe("proof counters", () => {
  it("locks a person after ten wrong proofs in a quarter of an hour, until it passes", async () => {
    for (let i = 0; i < 9; i += 1) {
      await countWrongProof(store, "person-a")
    }
    expect(await proofsLocked(store, "person-a")).toBe(false)

    await countWrongProof(store, "person-a")
    expect(await proofsLocked(store, "person-a")).toBe(true)
    expect(await proofsLocked(store, "person-b")).toBe(false)

    now += 15 * 60 * 1000 + 1
    expect(await proofsLocked(store, "person-a")).toBe(false)
  })

  it("locks a person after thirty wrong proofs in a day", async () => {
    for (let round = 0; round < 3; round += 1) {
      for (let i = 0; i < 10; i += 1) {
        await countWrongProof(store, "person-c")
      }
      now += 15 * 60 * 1000 + 1
    }
    expect(await proofsLocked(store, "person-c")).toBe(true)
  })

  it("reading the lock counts nothing", async () => {
    for (let i = 0; i < 50; i += 1) {
      await proofsLocked(store, "person-d")
    }
    expect(await proofsLocked(store, "person-d")).toBe(false)
  })

  it("bounds the proofs a person sends in a minute", async () => {
    const results: boolean[] = []
    for (let i = 0; i <= PROOF_BURST.tries; i += 1) {
      results.push(await proofBurstExceeded(store, "person-e"))
    }
    expect(results.slice(0, PROOF_BURST.tries).every((over) => !over)).toBe(true)
    expect(results[PROOF_BURST.tries]).toBe(true)
  })

  it("locks one scope of a person, never the others, until the ceiling", async () => {
    for (let i = 0; i < 10; i += 1) {
      await countScopedWrongProof(store, "person-f", "stolen-session")
    }

    expect(await scopedProofsLocked(store, "person-f", "stolen-session")).toBe(true)
    expect(await scopedProofsLocked(store, "person-f", "own-session")).toBe(false)
    expect(await proofsLocked(store, "person-f")).toBe(false)

    for (let i = 0; i < SCOPED_PROOF_CEILING.tries - 10; i += 1) {
      await countScopedWrongProof(store, "person-f", `scope-${String(i % 9)}`)
      if (i % 9 === 8) {
        // Each scope stays under its own quarter-hour lock
        now += 15 * 60 * 1000 + 1
      }
    }
    expect(await scopedProofsLocked(store, "person-f", "fresh-session")).toBe(true)
  })

  it("takes a code once for two minutes", async () => {
    expect(await firstCodeUse(store, "id-1:123456")).toBe(true)
    expect(await firstCodeUse(store, "id-1:123456")).toBe(false)
    expect(await firstCodeUse(store, "id-2:123456")).toBe(true)

    now += 2 * 60 * 1000 + 1
    expect(await firstCodeUse(store, "id-1:123456")).toBe(true)
  })
})
