import { createHmac } from "node:crypto"
import { describe, expect, it } from "vitest"
import { AddressBudget, NonceLedger, scopesOf, signedText, verifyRefresh } from "../verify"
import type { RefreshSignal } from "../verify"

const SECRET = "a-test-secret-of-at-least-32-characters!!"
const NOW_MS = 1_800_000_000_000
const NOW = String(NOW_MS / 1000)
const NONCE = "0123456789abcdef0123456789abcdef"

/** A signal as the backend makes it (adr/0048 Ek 2026-11-03). */
function signal(
  overrides: { time?: string; nonce?: string; scopes?: unknown; at?: unknown; secret?: string } = {}
) {
  const time = overrides.time ?? NOW
  const nonce = overrides.nonce ?? NONCE
  const scopes = overrides.scopes ?? ["settings", "legal"]
  const text = `${time}.${nonce}.${(scopes as string[]).join(",")}`
  return {
    time,
    signature: createHmac("sha256", overrides.secret ?? SECRET)
      .update(text)
      .digest("hex"),
    body: { scopes, at: overrides.at ?? Number(time), nonce },
  }
}

const check = (input: RefreshSignal, nonces = new NonceLedger(), now = NOW_MS) =>
  verifyRefresh(input, SECRET, now, nonces)

describe("the refresh signal's checks", () => {
  it("takes the backend's signed signal and answers its scopes", () => {
    expect(check(signal())).toEqual(["settings", "legal"])
    expect(signedText("1", NONCE, ["layout", "site"])).toBe(`1.${NONCE}.layout,site`)
  })

  it("refuses another key's signature, a changed body and a broken signature", () => {
    expect(check(signal({ secret: "another-secret-of-at-least-32-characters" }))).toBeNull()
    const changed = signal()
    changed.body.scopes = ["settings", "legal", "site"]
    expect(check(changed)).toBeNull()
    expect(check({ ...signal(), signature: "zz" })).toBeNull()
    expect(check({ ...signal(), signature: null })).toBeNull()
    expect(check({ ...signal(), signature: "A".repeat(64) })).toBeNull()
  })

  it("refuses a time more than a minute either way, or a body's time that differs", () => {
    expect(check(signal({ time: String(NOW_MS / 1000 - 60) }))).not.toBeNull()
    expect(check(signal({ time: String(NOW_MS / 1000 - 61) }))).toBeNull()
    expect(check(signal({ time: String(NOW_MS / 1000 + 61) }))).toBeNull()
    expect(check(signal({ at: NOW_MS / 1000 - 1 }))).toBeNull()
    expect(check(signal({ at: NOW }))).toBeNull()
    expect(check({ ...signal(), time: null })).toBeNull()
    expect(check(signal({ time: "1e9" }))).toBeNull()
  })

  it("refuses a nonce out of form, and the same nonce within two minutes", () => {
    expect(check(signal({ nonce: "0123456789ABCDEF0123456789ABCDEF" }))).toBeNull()
    expect(check(signal({ nonce: "short" }))).toBeNull()
    const nonces = new NonceLedger()
    expect(check(signal(), nonces)).not.toBeNull()
    expect(check(signal(), nonces)).toBeNull()
    // Two minutes on, the nonce is forgotten (and the time must be new by then anyway)
    const later = NOW_MS + 121_000
    const fresh = signal({ time: String(later / 1000) })
    expect(check(fresh, nonces, later)).not.toBeNull()
  })

  it("keeps a nonce only once its signature held, and never more than its limit", () => {
    const nonces = new NonceLedger(120_000, 3)
    expect(check(signal({ secret: "another-secret-of-at-least-32-characters" }), nonces)).toBeNull()
    expect(nonces.size).toBe(0)
    for (const digit of ["1", "2", "3", "4", "5"]) {
      expect(check(signal({ nonce: digit.repeat(32) }), nonces)).not.toBeNull()
    }
    expect(nonces.size).toBe(3)
  })

  it("reads 1–6 known scopes, none twice", () => {
    expect(scopesOf(["layout", "settings", "menus", "legal", "content", "site"])).toHaveLength(6)
    expect(scopesOf([])).toBeNull()
    expect(scopesOf(["settings", "settings"])).toBeNull()
    expect(scopesOf(["everything"])).toBeNull()
    expect(scopesOf("settings")).toBeNull()
    expect(check(signal({ scopes: ["settings", "products"] }))).toBeNull()
  })
})

describe("the address budget", () => {
  it("lets 30 a minute through per address, then refuses until the minute ends", () => {
    const budget = new AddressBudget(30)
    for (let index = 0; index < 30; index++) {
      expect(budget.take("10.0.0.1", NOW_MS)).toBe(true)
    }
    expect(budget.take("10.0.0.1", NOW_MS)).toBe(false)
    expect(budget.take("10.0.0.2", NOW_MS)).toBe(true)
    expect(budget.take("10.0.0.1", NOW_MS + 60_001)).toBe(true)
  })
})
