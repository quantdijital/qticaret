import { CONTENT_DRAFTS_MODULE } from "../../../modules/content-drafts"
import type { DraftDecision } from "../../../modules/content-drafts/service"
import { STAFF_ROLES_MODULE } from "../../../modules/staff-roles"
import { decideSuggestion } from "../../../workflows/ai/decide-suggestion"

/**
 * #247 D3: a decision on a suggestion lands only while it is still open,
 * in the same statement that writes it (`decideOpen`): of two decisions
 * at once, both having read it open, one is written and the other is
 * 400 `ai.suggestion_not_open`, never a second write over the first.
 */

const TITLES = ["Keten Gömlek Yazlık", "Yazlık Keten Gömlek", "Nefes Alan Keten Gömlek"]

/** One open draft, its status changed by a conditional write as the database does. */
function containerWithDraft() {
  const row = { id: "cdraft_1", status: "draft", text: TITLES.join("\n"), kind: "seo_title" }
  const written: DraftDecision[] = []
  const drafts = {
    // Both reads see it open: the race is between the read and the write
    listContentDrafts: () => Promise.resolve([{ ...row, provider: "fake", status: "draft" }]),
    decideOpen: (id: string, decision: DraftDecision) => {
      if (id !== row.id || row.status !== "draft") {
        return Promise.resolve(false)
      }
      row.status = decision.status
      written.push(decision)
      return Promise.resolve(true)
    },
  }
  const container = {
    resolve: (key: string) => {
      if (key === CONTENT_DRAFTS_MODULE) {
        return drafts
      }
      if (key === STAFF_ROLES_MODULE) {
        return { roleOf: () => Promise.resolve("owner") }
      }
      return { isFeatureEnabled: () => Promise.resolve(true) }
    },
  }
  return { container: container as never, written, row }
}

describe("deciding a suggestion (#247 D3)", () => {
  it("writes one of two decisions at once and refuses the other", async () => {
    const { container, written, row } = containerWithDraft()
    const results = await Promise.allSettled([
      decideSuggestion(container, {
        id: "cdraft_1",
        decision: "accept",
        candidate_index: 1,
        user_id: "user_1",
      }),
      decideSuggestion(container, { id: "cdraft_1", decision: "dismiss", user_id: "user_2" }),
    ])

    const kept = results.filter((result) => result.status === "fulfilled")
    const refused = results.filter((result) => result.status === "rejected")
    expect(kept).toHaveLength(1)
    expect(refused).toHaveLength(1)
    expect(refused[0]).toMatchObject({ reason: { safeMessage: "ai.suggestion_not_open" } })
    expect(written).toHaveLength(1)
    expect(row.status).toBe(written[0]?.status)
  })

  it("answers the accepted candidate when its decision lands", async () => {
    const { container, written } = containerWithDraft()
    await expect(
      decideSuggestion(container, {
        id: "cdraft_1",
        decision: "accept",
        candidate_index: 2,
        user_id: "user_1",
      })
    ).resolves.toMatchObject({ status: "accepted", text: TITLES[2], candidate_index: 2 })
    expect(written[0]).toMatchObject({
      status: "approved",
      accepted_index: 2,
      decided_by: "user_1",
    })
  })
})
