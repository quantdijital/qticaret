import type { Env } from "../../lib/env"
import { E2E_OWNER_EMAIL, E2eOwnerError, checkE2eAddress } from "../e2e-owner"

const DB = "postgres://postgres:pw@localhost:55432/qticaret_cp"
const local = { NODE_ENV: "development", DATABASE_URL: DB } as Env
const live = { NODE_ENV: "production", DATABASE_URL: DB } as Env
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

  it("refuses a database off this machine, without naming it (C7 review L3)", () => {
    const remote = { ...local, DATABASE_URL: "postgres://u:secret@db.quantticaret.com:5432/cp" }

    expect(() => {
      checkE2eAddress(address, remote)
    }).toThrow("e2e-owner: only against a database on this machine")
    try {
      checkE2eAddress(address, remote)
    } catch (error) {
      expect((error as Error).message).not.toContain("quantticaret")
      expect((error as Error).message).not.toContain("secret")
    }
  })

  it("refuses a real account's address", () => {
    expect(() => {
      checkE2eAddress("owner@quant.test", local)
    }).toThrow(E2eOwnerError)
  })
})
