import { LIMIT_KEYS } from "@qticaret/types/control-plane"
import { packageChanges } from "../../../api/admin/cp/plans/changes"
import type { PackageRecord } from "../../../modules/plans/types"
import { effectiveLimits, fullLimits } from "../limits"

const NOW = new Date("2026-11-11T09:00:00Z")

describe("the limits a shop has (adr/0061 §2)", () => {
  const pkg = fullLimits({ products: 500, staff: 3 })

  it("names every registry key, null where the package gives none", () => {
    expect(Object.keys(pkg).sort()).toEqual([...LIMIT_KEYS].sort())
    expect(pkg.orders_per_month).toBeNull()
  })

  it("takes the package's value, an exception's over it while it holds", () => {
    const limits = effectiveLimits(
      pkg,
      [
        { key: "products", value: 2000, expires_at: null },
        { key: "staff", value: 10, expires_at: "2026-11-10T00:00:00Z" },
        { key: "storage_mb", value: null, expires_at: "2026-12-01T00:00:00Z" },
      ],
      NOW
    )
    const of = (key: string) => limits.find((each) => each.key === key)

    expect(of("products")).toEqual({ key: "products", package: 500, override: 2000, value: 2000 })
    // Ended: the package's again
    expect(of("staff")).toEqual({ key: "staff", package: 3, override: undefined, value: 3 })
    // An exception of "no limit" over a package's limit
    expect(of("storage_mb")?.value).toBeNull()
    expect(of("storage_mb")?.override).toBeNull()
  })

  it("has no limit without a package, as the shop's unmanaged mode", () => {
    for (const limit of effectiveLimits(null, [], NOW)) {
      expect(limit.value).toBeNull()
      expect(limit.package).toBeUndefined()
    }
  })
})

describe("a package change as the audit keeps it", () => {
  const before: PackageRecord = {
    id: "pkg_1",
    code: "baslangic",
    name: "Başlangıç",
    price: 49_000,
    currency_code: "TRY",
    period: "monthly",
    trial_days: 14,
    grace_days: 7,
    archived_at: null,
    created_at: NOW,
    limits: fullLimits({ products: 500 }),
  }

  it("names only what moved, from and to", () => {
    const after = {
      ...before,
      price: 59_000,
      archived_at: NOW,
      limits: { ...before.limits, products: 1000 },
    }

    expect(packageChanges(before, after)).toEqual({
      price: { from: 49_000, to: 59_000 },
      archived: { from: false, to: true },
      "limits.products": { from: 500, to: 1000 },
    })
  })
})
