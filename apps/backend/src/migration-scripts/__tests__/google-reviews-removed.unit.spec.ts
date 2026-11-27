import { removeRetiredReviews, withoutRetiredSections } from "../google-reviews-removed"
import type { RetiredReviewsPorts } from "../google-reviews-removed"

function ports(found: { tables: string[]; migrations: number; sections: number }) {
  return {
    existingTables: jest.fn(async () => Promise.resolve(found.tables)),
    dropTables: jest.fn(async () => Promise.resolve()),
    forgetMigrations: jest.fn(async () => Promise.resolve(found.migrations)),
    cleanLayouts: jest.fn(async () =>
      Promise.resolve({ documents: found.sections > 0 ? 1 : 0, sections: found.sections })
    ),
  } satisfies RetiredReviewsPorts
}

describe("Google reviews' leftovers (adr/0058 Kaldırıldı 2026-11-27 migration script)", () => {
  it("drops the tables, forgets the migrations and cleans the designs", async () => {
    const fake = ports({
      tables: ["google_review", "google_review_location"],
      migrations: 3,
      sections: 2,
    })

    expect(await removeRetiredReviews(fake)).toEqual({
      tables: 2,
      migrations: 3,
      documents: 1,
      sections: 2,
    })
    expect(fake.dropTables).toHaveBeenCalledTimes(1)
  })

  it("drops nothing when the tables are gone: a second run is harmless", async () => {
    const fake = ports({ tables: [], migrations: 0, sections: 0 })

    expect(await removeRetiredReviews(fake)).toEqual({
      tables: 0,
      migrations: 0,
      documents: 0,
      sections: 0,
    })
    expect(fake.dropTables).not.toHaveBeenCalled()
  })
})

describe("withoutRetiredSections", () => {
  it("takes the Google rating sections out of every group and content page, nothing else", () => {
    const stored = {
      home: [
        { id: "a", type: "hero" },
        { id: "g", type: "google_rating", excerpts: 2, profile_link: true },
      ],
      footer: [{ id: "f", type: "footer_bar" }],
      pages: [
        {
          page_id: "p1",
          sections: [
            { id: "g2", type: "google_rating" },
            { id: "r", type: "reviews" },
          ],
        },
      ],
      settings: { theme: {} },
    }

    expect(withoutRetiredSections(stored)).toEqual({
      removed: 2,
      document: {
        home: [{ id: "a", type: "hero" }],
        footer: [{ id: "f", type: "footer_bar" }],
        pages: [{ page_id: "p1", sections: [{ id: "r", type: "reviews" }] }],
        settings: { theme: {} },
      },
    })
  })

  it("gives back the same document when it has none, and anything else as it is", () => {
    const stored = { home: [{ id: "a", type: "hero" }] }
    expect(withoutRetiredSections(stored)).toEqual({ document: stored, removed: 0 })
    expect(withoutRetiredSections(stored).document).toBe(stored)
    expect(withoutRetiredSections(null)).toEqual({ document: null, removed: 0 })
  })
})
