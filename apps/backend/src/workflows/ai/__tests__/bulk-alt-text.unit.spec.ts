import { IMAGE_ALT_BULK_MAX } from "../../../lib/ai/registry/tasks"
import { AiAltTextInput, errorKeyOf, runBulkAltText } from "../bulk-alt-text"
import type { BulkAltTextDeps } from "../bulk-alt-text"

/**
 * The bulk alt text job (docs/22 "Aşama 5"): ids only, at most 50, only
 * images worth asking for, each its own ask; it stops where every later
 * ask would fail the same way.
 */

const ids = (count: number) => Array.from({ length: count }, (_, i) => `media_${String(i + 1)}`)

function depsWith(
  options: {
    eligible?: (ids: readonly string[]) => string[]
    answer?: (id: string) => "draft" | "refused" | Error
  } = {}
): BulkAltTextDeps & { asked: string[]; seen: string[][]; percents: number[] } {
  const asked: string[] = []
  const seen: string[][] = []
  const percents: number[] = []
  return {
    asked,
    seen,
    percents,
    eligible: (list) => {
      seen.push([...list])
      return Promise.resolve(options.eligible ? options.eligible(list) : [...list])
    },
    suggest: (id) => {
      asked.push(id)
      const answer = options.answer ? options.answer(id) : "draft"
      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer)
    },
    progress: (percent) => {
      percents.push(percent)
      return Promise.resolve()
    },
  }
}

const keyed = (shape: Record<string, unknown>) => Object.assign(new Error("x"), shape)

describe("bulk alt text job input", () => {
  it("takes 1 to 50 image ids and an optional service, nothing else", () => {
    expect(AiAltTextInput.safeParse({ media_ids: ids(IMAGE_ALT_BULK_MAX) }).success).toBe(true)
    expect(AiAltTextInput.safeParse({ media_ids: ids(51) }).success).toBe(false)
    expect(AiAltTextInput.safeParse({ media_ids: [] }).success).toBe(false)
    expect(AiAltTextInput.safeParse({ media_ids: ["prod_1"] }).success).toBe(false)
    expect(AiAltTextInput.safeParse({ media_ids: ["media_1"], prompt: "yaz" }).success).toBe(false)
    expect(AiAltTextInput.safeParse({ media_ids: ["media_1"], service: "gemini" }).success).toBe(
      true
    )
  })
})

describe("bulk alt text run", () => {
  it("asks once per image worth asking for, never past the limit, counting the rest skipped", async () => {
    const deps = depsWith({ eligible: (list) => list.filter((_, i) => i % 2 === 0) })
    const summary = await runBulkAltText(deps, [...ids(60), "media_1"])
    expect(deps.seen[0]).toHaveLength(IMAGE_ALT_BULK_MAX)
    expect(deps.asked).toHaveLength(25)
    expect(summary).toEqual({
      asked: 25,
      suggested: 25,
      refused: 0,
      failed: 0,
      skipped: 25,
      not_asked: 0,
      stopped: null,
    })
    expect(deps.percents.at(-1)).toBe(100)
  })

  it("counts refused and failed asks and goes on", async () => {
    const deps = depsWith({
      answer: (id) =>
        id === "media_2"
          ? "refused"
          : id === "media_3"
            ? keyed({ qtErrorKind: "provider", safeMessage: "ai.timeout" })
            : "draft",
    })
    expect(await runBulkAltText(deps, ids(4))).toMatchObject({
      asked: 4,
      suggested: 2,
      refused: 1,
      failed: 1,
      stopped: null,
    })
  })

  it.each([
    [{ qtErrorKind: "plan_limit" }, "plan.limit_reached"],
    [
      { qtErrorKind: "validation", safeMessage: "ai.daily_limit_reached" },
      "ai.daily_limit_reached",
    ],
    [{ qtErrorKind: "validation", safeMessage: "ai.no_service" }, "ai.no_service"],
    [{ message: "staff.forbidden" }, "staff.forbidden"],
  ])("stops on %j and leaves the rest not asked", async (shape, key) => {
    const deps = depsWith({ answer: (id) => (id === "media_3" ? keyed(shape) : "draft") })
    const summary = await runBulkAltText(deps, ids(10))
    expect(deps.asked).toEqual(["media_1", "media_2", "media_3"])
    expect(summary).toMatchObject({ asked: 2, suggested: 2, not_asked: 8, stopped: key })
  })

  it("reads the key from any shape a workflow hands back", () => {
    expect(errorKeyOf(null)).toBe("")
    expect(errorKeyOf({ safeMessage: "ai.timeout", message: "x" })).toBe("ai.timeout")
  })
})
