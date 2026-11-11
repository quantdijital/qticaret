import type { Env } from "../../lib/env"
import { slugProblem } from "../../lib/tenants/slug"
import { E2E_SHOP_SLUG, E2eShopError, checkE2eSlug } from "../e2e-shop"

const DB = "postgres://postgres:pw@localhost:55432/qticaret_cp"
const local = { NODE_ENV: "development", DATABASE_URL: DB } as Env
const slug = "e2e-1762800000000-a1b2c3"

describe("the e2e shop script's guard (C11)", () => {
  it("takes only the slug shape the panel's e2e makes, itself a valid slug", () => {
    expect(E2E_SHOP_SLUG.test(slug)).toBe(true)
    expect(slugProblem(slug)).toBeNull()
    for (const other of [
      "mylarte",
      "e2e-1762800000000",
      "e2e-1762800000000-a1b2c3-x",
      `x${slug}`,
    ]) {
      expect(E2E_SHOP_SLUG.test(other)).toBe(false)
    }
  })

  it("runs on a developer's machine for an e2e slug only", () => {
    expect(() => {
      checkE2eSlug(slug, local)
    }).not.toThrow()
    expect(() => {
      checkE2eSlug("mylarte", local)
    }).toThrow(E2eShopError)
  })

  it("refuses anywhere but development and test, and a database off this machine", () => {
    expect(() => {
      checkE2eSlug(slug, { ...local, NODE_ENV: "production" })
    }).toThrow("e2e-shop: only in development or test")
    expect(() => {
      checkE2eSlug(slug, { ...local, DATABASE_URL: "postgres://u:p@db.quantticaret.com/cp" })
    }).toThrow("e2e-shop: only against a database on this machine")
  })
})
