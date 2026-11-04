import { describe, expect, it } from "vitest"
import { groupKey, groupsApi, groupsForm } from "./groups"

// The server's rule for a section's key (backend product-attributes/validation.ts)
const KEY = /^[a-z0-9][a-z0-9_-]{0,39}$/

describe("spec table groups", () => {
  it("makes a key the server takes from a Turkish name, numbered on a clash", () => {
    expect(groupKey("Ölçüler ve Ağırlık", [])).toBe("olculer_ve_agirlik")
    expect(groupKey("Ölçüler", ["olculer"])).toBe("olculer_2")
    expect(groupKey("Ölçüler", ["olculer", "olculer_2"])).toBe("olculer_3")
  })

  it("keeps a key for a name without letters, and within forty characters", () => {
    expect(groupKey("2026", [])).toBe("2026")
    expect(groupKey("—", [])).toBe("group")
    const long = groupKey("Çok uzun bir bölüm adı ki kırk karakteri rahatça aşıyor", [])
    expect(long).toMatch(KEY)
    const taken = groupKey("Çok uzun bir bölüm adı ki kırk karakteri rahatça aşıyor", [long])
    expect(taken).toMatch(KEY)
    expect(taken.endsWith("_2")).toBe(true)
  })

  it("reads the saved sections in rank order and sends list order back as rank", () => {
    const form = groupsForm([
      { key: "b", name: "Bakım", rank: 5 },
      { key: "a", name: "Ölçüler", rank: 1 },
    ])
    expect(form).toEqual([
      { key: "a", name: "Ölçüler" },
      { key: "b", name: "Bakım" },
    ])
    expect(groupsApi([{ key: "b", name: " Bakım " }, ...form.slice(0, 1)])).toEqual([
      { key: "b", name: "Bakım", rank: 0 },
      { key: "a", name: "Ölçüler", rank: 1 },
    ])
  })
})
