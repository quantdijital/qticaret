import { AI_CREDIT_TASKS } from "@qticaret/types/control-plane"
import { describe, expect, it } from "vitest"
import en from "@/locales/en.json"
import tr from "@/locales/tr.json"

interface Tree {
  [key: string]: string | Tree
}

/** Every leaf key under a tree, dotted. */
const keysOf = (tree: Tree, prefix = ""): string[] =>
  Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "string" ? [`${prefix}${key}`] : keysOf(value, `${prefix}${key}.`)
  )

const at = (tree: unknown, path: string): unknown =>
  path.split(".").reduce<unknown>((node, key) => (node as Tree | undefined)?.[key], tree)

describe("the platform credits' words (adr/0085 §5)", () => {
  it("are the same keys in Turkish and English", () => {
    expect(keysOf(tr.ai.credits as Tree).sort()).toEqual(keysOf(en.ai.credits as Tree).sort())
  })

  it.each([
    "ai.services.platform.name",
    "ai.data_note.platform",
    "ai.errors.credits_exhausted",
    "ai.errors.credits_daily_cap",
    "ai.errors.platform_busy",
    "ai.errors.platform_unavailable",
    "ai.errors.credits_order_open",
    "ai.errors.credits_pack_unknown",
  ])("name %s in both languages", (path) => {
    expect(typeof at(tr, path)).toBe("string")
    expect(typeof at(en, path)).toBe("string")
  })

  it("name every task the credit table can list", () => {
    for (const task of AI_CREDIT_TASKS) {
      expect([task, typeof at(tr, `ai.tasks.${task}`)]).toEqual([task, "string"])
      expect([task, typeof at(en, `ai.tasks.${task}`)]).toEqual([task, "string"])
    }
  })
})
