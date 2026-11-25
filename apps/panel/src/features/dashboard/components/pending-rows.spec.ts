import { describe, expect, it } from "vitest"
import { pendingBadges } from "@/features/dashboard/api/pending"

describe("the menu's badges", () => {
  it("sums an item's lists and reads a closed list as nothing", () => {
    expect(
      pendingBadges({
        pending_reviews: 2,
        pending_questions: 3,
        open_returns: 1,
        unread_contact: null,
        out_of_stock: 4,
      })
    ).toEqual({ reviews: 5, customers: 0, inventory: 4 })
    expect(pendingBadges(undefined)).toEqual({})
  })
})
