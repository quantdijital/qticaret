import { describe, expect, it } from "vitest"
import type { MigrationJob } from "@/features/settings/api/migration"
import { neededBy } from "@/features/settings/api/migration-overview"
import {
  fixOf,
  kindsFound,
  withoutKind,
} from "@/features/settings/components/migration/wizard/kinds"
import {
  draftProblem,
  emptyDraft,
  startOf,
} from "@/features/settings/components/migration/wizard/state"

const job = (counts: Record<string, Record<string, number>>): MigrationJob =>
  ({
    id: "ajob_1",
    status: "succeeded",
    result_summary: { mode: "check", counts },
  }) as unknown as MigrationJob

describe("the new migration's kinds", () => {
  it("ticks what the preview found, and the 301s with it", () => {
    expect(
      kindsFound(job({ product: { read: 3 }, image: { read: 9 }, customer: { read: 0 } }))
    ).toEqual(["product", "image", "url"])
    expect(kindsFound(job({ product: { read: 0 } }))).toEqual([])
  })

  it("locks what a ticked kind needs, and drops what needs a kind ticked off", () => {
    const needed = neededBy(new Set(["image", "order"] as const))
    expect([...needed.keys()].sort()).toEqual(["brand", "category", "customer", "product"])
    expect(needed.get("category")).toBe("image")
    expect([...withoutKind(new Set(["product", "image", "review", "post"]), "product")]).toEqual([
      "post",
    ])
  })

  it("maps a problem to its fix", () => {
    const group = (kind: string, key: string) => ({ kind, key, count: 1, samples: [] })
    expect(fixOf(group("image", "migration.image_unreachable"))).toBe("images")
    expect(fixOf(group("category", "migration.category_cover_no_category"))).toBe("category_covers")
    expect(fixOf(group("product", "migration.product_handle_taken"))).toBe("products")
    expect(fixOf(group("review", "migration.review_no_product"))).toBeNull()
  })
})

describe("the new migration's draft", () => {
  it("asks for what each source needs", () => {
    expect(draftProblem(emptyDraft("wordpress"))).toBe(
      "settings.migration.wordpress.errors.fileRequired"
    )
    expect(draftProblem(emptyDraft("feed"))).toBe("settings.migration.wizard.urlRequired")
    expect(draftProblem({ ...emptyDraft("feed"), url: "https://eski.example/google.xml" })).toBe(
      null
    )
    expect(draftProblem(emptyDraft("shopify"))).toBeNull()
    const file = new File(["<rss/>"], "site.xml")
    expect(draftProblem({ ...emptyDraft("wordpress"), file, categoryBase: "/a/b/" })).toBe(
      "settings.migration.wordpress.errors.categoryBase"
    )
    expect(
      draftProblem({
        ...emptyDraft("wordpress"),
        file,
        parcel: { weight: "5", length: "", width: "", height: "" },
      })
    ).toBe("settings.migration.wordpress.errors.parcel")
  })

  it("sends the kinds chosen and the owner's parcel", () => {
    const draft = {
      ...emptyDraft("feed"),
      url: " https://eski.example/google.xml ",
      parcel: { weight: "500", length: "30", width: "20", height: "10" },
    }
    expect(startOf(draft, "apply", ["product", "url"])).toMatchObject({
      kind: "feed",
      mode: "apply",
      url: "https://eski.example/google.xml",
      parcel: { weight: 500, length: 30, width: 20, height: 10 },
      kinds: ["product", "url"],
    })
  })
})
