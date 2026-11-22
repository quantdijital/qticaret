import { SEO_FILL_MAX } from "../../../lib/ai/bulk-seo"
import type { SeoFillTarget } from "../../../lib/ai/bulk-seo"
import { AiSeoFillInput, runSeoFill } from "../bulk-seo/fill"
import type { SeoFillAsk, SeoFillDeps } from "../bulk-seo/fill"

/**
 * The bulk SEO fill job (adr/0074 §5 madde 7): at most 50 pages, each
 * checked again, each task its own ask; a lone failure is counted and the
 * job goes on, a ceiling stops it.
 */

const pages = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    entity_type: "product" as const,
    entity_id: `prod_${String(i + 1)}`,
  }))

const keyed = (shape: Record<string, unknown>) => Object.assign(new Error("x"), shape)

function depsWith(
  options: {
    eligible?: (list: readonly { entity_type: string; entity_id: string }[]) => SeoFillTarget[]
    answer?: (ask: SeoFillAsk) => "draft" | "refused" | Error
    waiting?: (ask: SeoFillAsk) => boolean
  } = {}
): SeoFillDeps & { asked: string[]; seen: number[] } {
  const asked: string[] = []
  const seen: number[] = []
  return {
    asked,
    seen,
    eligible: (list) => {
      seen.push(list.length)
      return Promise.resolve(
        options.eligible
          ? options.eligible(list)
          : list.map((page) => ({
              entity_type: "product" as const,
              entity_id: page.entity_id,
              tasks: ["seo_title", "seo_description"],
            }))
      )
    },
    waiting: (ask) => Promise.resolve(options.waiting ? options.waiting(ask) : false),
    suggest: (ask) => {
      asked.push(`${ask.entity_id}:${ask.task}`)
      const answer = options.answer ? options.answer(ask) : "draft"
      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer)
    },
    progress: () => Promise.resolve(),
  }
}

describe("seo fill job input", () => {
  it("takes 1 to 50 pages, the fields and an optional service, nothing else", () => {
    const fields = ["seo_title", "seo_description"]
    expect(AiSeoFillInput.safeParse({ fields, pages: pages(SEO_FILL_MAX) }).success).toBe(true)
    expect(AiSeoFillInput.safeParse({ fields, pages: pages(SEO_FILL_MAX + 1) }).success).toBe(false)
    expect(AiSeoFillInput.safeParse({ fields, pages: [] }).success).toBe(false)
    expect(AiSeoFillInput.safeParse({ fields: [], pages: pages(1) }).success).toBe(false)
    expect(AiSeoFillInput.safeParse({ fields: ["slug"], pages: pages(1) }).success).toBe(false)
    expect(AiSeoFillInput.safeParse({ fields, pages: pages(1), prompt: "yaz" }).success).toBe(false)
    expect(
      AiSeoFillInput.safeParse({
        fields,
        pages: [{ entity_type: "product", entity_id: "prod 1; drop" }],
      }).success
    ).toBe(false)
  })
})

describe("seo fill run", () => {
  it("asks each page's tasks in turn, never past the limit, counting what was fixed meanwhile", async () => {
    const deps = depsWith({
      // prod_2 was fixed meanwhile; prod_3 only lacks its description
      eligible: (list) =>
        list.flatMap((page) =>
          page.entity_id === "prod_2"
            ? []
            : [
                {
                  entity_type: "product" as const,
                  entity_id: page.entity_id,
                  tasks: page.entity_id === "prod_3" ? ["seo_description"] : ["seo_title"],
                },
              ]
        ),
    })
    const summary = await runSeoFill(deps, {
      fields: ["seo_title", "seo_description"],
      pages: [...pages(3), { entity_type: "product", entity_id: "prod_1" }],
    })
    expect(deps.seen).toEqual([3])
    expect(deps.asked).toEqual(["prod_1:seo_title", "prod_3:seo_description"])
    expect(summary).toMatchObject({ pages: 3, asked: 2, suggested: 2, skipped: 2, stopped: null })
  })

  it("asks only the fields chosen", async () => {
    const deps = depsWith()
    await runSeoFill(deps, { fields: ["seo_description"], pages: pages(2) })
    expect(deps.asked).toEqual(["prod_1:seo_description", "prod_2:seo_description"])
  })

  it("keeps going past a lone failure or refusal: partial success", async () => {
    const deps = depsWith({
      answer: (ask) =>
        ask.entity_id === "prod_1" && ask.task === "seo_title"
          ? keyed({ safeMessage: "ai.timeout" })
          : ask.entity_id === "prod_2" && ask.task === "seo_description"
            ? "refused"
            : "draft",
    })
    const summary = await runSeoFill(deps, {
      fields: ["seo_title", "seo_description"],
      pages: pages(2),
    })
    expect(summary).toMatchObject({ asked: 4, suggested: 2, refused: 1, failed: 1, stopped: null })
  })

  it("stops at a ceiling and counts the rest as not asked", async () => {
    const deps = depsWith({
      answer: (ask) =>
        ask.entity_id === "prod_2" ? keyed({ qtErrorKind: "plan_limit" }) : "draft",
    })
    const summary = await runSeoFill(deps, { fields: ["seo_title"], pages: pages(4) })
    expect(deps.asked).toEqual(["prod_1:seo_title", "prod_2:seo_title"])
    expect(summary).toMatchObject({
      asked: 1,
      suggested: 1,
      not_asked: 3,
      stopped: "plan.limit_reached",
    })
  })

  it("does not ask twice for a suggestion made meanwhile", async () => {
    const deps = depsWith({ waiting: (ask) => ask.entity_id === "prod_1" })
    const summary = await runSeoFill(deps, { fields: ["seo_title"], pages: pages(2) })
    expect(deps.asked).toEqual(["prod_2:seo_title"])
    expect(summary).toMatchObject({ asked: 1, skipped: 1 })
  })
})
