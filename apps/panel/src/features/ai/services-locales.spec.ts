import { describe, expect, it } from "vitest"
import en from "@/locales/en.json"
import tr from "@/locales/tr.json"
import { AI_SERVICE_IDS } from "./services"

// What would give a development stand-in away on screen (owner rule: fakes look like production)
const GIVEAWAY = /sahte|deneme|demo|test|fake|geliştirme|development|bu bilgisayar|this computer/i

/** Every text under a tree, flattened. */
const textsOf = (node: unknown): string[] =>
  typeof node === "string"
    ? [node]
    : node !== null && typeof node === "object"
      ? Object.values(node).flatMap(textsOf)
      : []

describe("the AI services' words", () => {
  it.each(AI_SERVICE_IDS)("name %s in both languages", (id) => {
    expect(typeof tr.ai.services[id].name).toBe("string")
    expect(typeof en.ai.services[id].name).toBe("string")
  })

  it("show the development service like any provider, never as a fake", () => {
    const shown = [tr, en].flatMap((words) => [
      ...textsOf(words.ai.services.fake),
      words.ai.data_note.fake,
      words.ai.data_detail.fake,
    ])
    expect(shown.filter((text) => GIVEAWAY.test(text))).toEqual([])
  })
})
