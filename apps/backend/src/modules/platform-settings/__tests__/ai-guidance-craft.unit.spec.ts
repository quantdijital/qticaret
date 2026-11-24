import type { MedusaRequest } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { refuseCraftUnlessOwner } from "../../../api/admin/ai/craft-owner"
import { defaultCraftOf } from "../../../lib/ai/instructions"
import { guidanceText } from "../../../lib/ai/guidance"
import { SECTIONS } from "../sections"
import {
  CRAFT_BASE_UNKNOWN,
  guidanceSaveIssue,
  mergeGuidance,
  sendsCraft,
} from "../sections/ai-guidance-craft"
import { GUIDANCE_LIMITS } from "../sections/ai-guidance"
import type { AiGuidanceSettings } from "../sections/ai-guidance"

/**
 * adr/0074 §3 in the `ai_guidance` section: a task's craft and the
 * default's version beside it, as a save lands them (the store's own
 * order: the patch's schema, the merge, the full schema, the save rule);
 * the owner's alone (403 for anyone else); the words quoted without
 * their own quote marks (#247 B1).
 */

const { full, patch, defaults } = SECTIONS.ai_guidance
const CURRENT = defaultCraftOf("seo_title")
const OLD_BASE = "0123456789ab"

/** A save as the settings store makes it: before, then the body. */
function save(before: AiGuidanceSettings, body: Record<string, unknown>) {
  const sent = patch.parse(body)
  const after = full.parse(mergeGuidance(before, sent))
  return { after, issue: guidanceSaveIssue(after, before) }
}

const stored = (entry: Record<string, unknown>): AiGuidanceSettings =>
  full.parse({ ...defaults, tasks: { seo_title: { extra: null, examples: [], ...entry } } })

describe("a task's craft in a save", () => {
  it("is held as any guidance text, up to its own limit", () => {
    const parsed = patch.parse({
      tasks: { seo_title: { craft: "Rol: <b>yazar</b>\n\n\n\nAra 0532 123 45 67" } },
    }) as { tasks: Record<string, { craft?: string | null }> }
    expect(parsed.tasks["seo_title"]?.craft).toBe("Rol: yazar\n\nAra […]")
    const tooLong = patch.safeParse({
      tasks: { seo_title: { craft: "a".repeat(GUIDANCE_LIMITS.craft + 1) } },
    })
    expect(tooLong.error?.issues.map((issue) => issue.message)).toContain("ai.guidance_too_long")
  })

  it("is written with the current default's version", () => {
    const { after, issue } = save(defaults, { tasks: { seo_title: { craft: "Kısa yaz." } } })
    expect(issue).toBeNull()
    expect(after.tasks["seo_title"]).toEqual({
      extra: null,
      examples: [],
      craft: "Kısa yaz.",
      craft_base: CURRENT?.version,
    })
  })

  it("is kept, with its old version, by a save that does not send it (an admin's note)", () => {
    const before = stored({ craft: "Benim talimatım.", craft_base: OLD_BASE })
    const { after, issue } = save(before, { tasks: { seo_title: { extra: "Markayı sona koy" } } })
    expect(issue).toBeNull()
    expect(after.tasks["seo_title"]).toMatchObject({
      extra: "Markayı sona koy",
      craft: "Benim talimatım.",
      craft_base: OLD_BASE,
    })
  })

  it("leaves an admin's note and examples in place when the owner saves the craft alone", () => {
    const before = stored({ extra: "Markayı sona koy", examples: ["Örnek başlık"] })
    const { after, issue } = save(before, { tasks: { seo_title: { craft: "Önce ürün adı." } } })
    expect(issue).toBeNull()
    expect(after.tasks["seo_title"]).toMatchObject({
      extra: "Markayı sona koy",
      examples: ["Örnek başlık"],
      craft: "Önce ürün adı.",
    })
    // Sent empty, they are cleared: leaving out is not clearing
    const cleared = save(after, { tasks: { seo_title: { extra: null, examples: [] } } })
    expect(cleared.after.tasks["seo_title"]).toMatchObject({
      extra: null,
      examples: [],
      craft: "Önce ürün adı.",
    })
  })

  it("makes a first entry whole: no note and no examples unless sent", () => {
    const { after } = save(full.parse(defaults), {
      tasks: { seo_title: { craft: "Önce ürün adı." } },
    })
    expect(after.tasks["seo_title"]).toMatchObject({ extra: null, examples: [] })
  })

  it("keeps its old version when sent unchanged, and takes the current when its text changes", () => {
    const before = stored({ craft: "Benim talimatım.", craft_base: OLD_BASE })
    const same = save(before, { tasks: { seo_title: { craft: "Benim talimatım." } } })
    expect(same.after.tasks["seo_title"]?.craft_base).toBe(OLD_BASE)
    const changed = save(before, { tasks: { seo_title: { craft: "Yeni talimatım." } } })
    expect(changed.after.tasks["seo_title"]?.craft_base).toBe(CURRENT?.version)
  })

  it("takes the current version when sent as it: the owner keeps theirs after a change", () => {
    const before = stored({ craft: "Benim talimatım.", craft_base: OLD_BASE })
    const kept = save(before, { tasks: { seo_title: { craft_base: CURRENT?.version } } })
    expect(kept.issue).toBeNull()
    expect(kept.after.tasks["seo_title"]).toMatchObject({
      craft: "Benim talimatım.",
      craft_base: CURRENT?.version,
    })
    // A version the server never wrote is refused
    const made = save(before, { tasks: { seo_title: { craft_base: "fedcba987654" } } })
    expect(made.issue).toEqual({
      message: CRAFT_BASE_UNKNOWN,
      path: ["tasks", "seo_title", "craft_base"],
    })
  })

  it("goes back to the default on null, or when it reads as the default", () => {
    const before = stored({ craft: "Benim talimatım.", craft_base: OLD_BASE })
    for (const craft of [null, CURRENT?.craft]) {
      const { after } = save(before, { tasks: { seo_title: { craft } } })
      expect(after.tasks["seo_title"]).toMatchObject({ craft: null, craft_base: null })
    }
    // A task never given one stays without the fields
    const { after } = save(defaults, { tasks: { seo_title: { extra: "x" } } })
    expect(after.tasks["seo_title"]).toEqual({ extra: "x", examples: [] })
  })

  it("passes every default craft through the section's cleaning unchanged", () => {
    for (const id of ["seo_title", "seo_description", "product_description", "review_reply"]) {
      const standard = defaultCraftOf(id)?.craft ?? ""
      expect(Array.from(standard).length).toBeLessThanOrEqual(GUIDANCE_LIMITS.craft)
      const parsed = patch.parse({ tasks: { [id]: { craft: standard } } }) as {
        tasks: Record<string, { craft?: string | null }>
      }
      expect(parsed.tasks[id]?.craft).toBe(standard)
    }
  })

  it("is not written for a task that takes none", () => {
    const after = { ...defaults, tasks: { made_up: { extra: null, examples: [], craft: "x" } } }
    expect(guidanceSaveIssue(after, defaults)?.path).toEqual(["tasks", "made_up", "craft"])
  })
})

describe("who may send a craft", () => {
  const request = (role: string | null) =>
    ({
      auth_context: { actor_type: "user", actor_id: "user_1" },
      scope: { resolve: () => ({ roleOf: () => Promise.resolve(role) }) },
    }) as unknown as MedusaRequest

  it("tells a body that sends a craft or its version from one that does not", () => {
    expect(sendsCraft({ seo_title: { craft: null } })).toBe(true)
    expect(sendsCraft({ seo_title: { craft_base: OLD_BASE } })).toBe(true)
    expect(sendsCraft({ seo_title: { extra: "x", examples: [] } })).toBe(false)
    expect(sendsCraft(undefined)).toBe(false)
    expect(sendsCraft(patch.parse({ tasks: { seo_title: { extra: "x" } } }))).toBe(false)
  })

  it("lets the owner only, refusing anyone else with its own key", async () => {
    const tasks = { seo_title: { craft: "Kısa yaz." } }
    await expect(refuseCraftUnlessOwner(request("owner"), tasks)).resolves.toBeUndefined()
    for (const role of ["admin", "operations", null]) {
      await expect(refuseCraftUnlessOwner(request(role), tasks)).rejects.toMatchObject({
        type: MedusaError.Types.FORBIDDEN,
        message: "ai.guidance_craft_owner_only",
      })
    }
    // A body without one is anyone's the section lets
    await expect(
      refuseCraftUnlessOwner(request("admin"), { seo_title: { extra: "x" } })
    ).resolves.toBeUndefined()
  })
})

describe("the words in the guidance (#247 B1)", () => {
  it("quotes each word without its own quote marks, a word of marks only left out", () => {
    const text = guidanceText(
      { ...defaults, prefer: ['el "yapımı"', "„dayanıklı“", '""'], avoid: ["‘ucuz’"] },
      "seo_title"
    )
    expect(text).toContain("tercih edilecek sözcükler: “el yapımı”, “dayanıklı”\n")
    expect(text).toContain("Hiç kullanılmayacak sözcükler: “ucuz”")
    expect(text).not.toContain("“”")
    // Only marks: no line at all
    expect(guidanceText({ ...defaults, avoid: ["''"] }, "seo_title")).toBeNull()
  })
})
