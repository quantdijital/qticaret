import type { Env } from "../../lib/env"
import { E2E_OWNER_EMAIL, E2eOwnerError, checkE2eAddress } from "../e2e-owner"

const local = { NODE_ENV: "development" } as Env
const live = { NODE_ENV: "production" } as Env
const address = "cp-e2e-1762800000000-a1b2c3@example.com"

describe("the e2e owner script's guard (Ek C6)", () => {
  it("takes only the address shape the panel's e2e setup makes", () => {
    expect(E2E_OWNER_EMAIL.test(address)).toBe(true)
    for (const other of [
      "owner@quant.test",
      "cp-e2e-1762800000000-a1b2c3@example.com.evil.test",
      "e2e-1762800000000-a1b2c3@example.com",
      `x${address}`,
    ]) {
      expect(E2E_OWNER_EMAIL.test(other)).toBe(false)
    }
  })

  it("runs on a developer's machine for an e2e address", () => {
    expect(() => {
      checkE2eAddress(address, local)
    }).not.toThrow()
  })

  it("refuses anywhere but development and test", () => {
    expect(() => {
      checkE2eAddress(address, live)
    }).toThrow(E2eOwnerError)
  })

  it("refuses a real account's address", () => {
    expect(() => {
      checkE2eAddress("owner@quant.test", local)
    }).toThrow(E2eOwnerError)
  })
})
