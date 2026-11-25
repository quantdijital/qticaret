import {
  ID_MAX,
  NOTE_MAX,
  REFERENCE_MAX,
  adjustRef,
  movedCredits,
  noteOf,
  optionalLine,
  purchaseRef,
  requiredLine,
} from "../inputs"

// Written by code point: a control character, a right-to-left override, a line separator
const BELL = String.fromCharCode(0x07)
const RLO = String.fromCharCode(0x202e)
const LINE_SEPARATOR = String.fromCharCode(0x2028)

describe("what the AI credits take from their callers (PR #368 review D1–D3)", () => {
  it("refuses text with control or format characters and text too long, never cuts it", () => {
    expect(requiredLine("  usr_01  ", ID_MAX, "actor")).toBe("usr_01")
    expect(() => requiredLine("   ", ID_MAX, "actor")).toThrow("cp.ai_credit_actor_required")
    expect(() => requiredLine("x".repeat(ID_MAX + 1), ID_MAX, "actor")).toThrow(
      "cp.ai_credit_actor_invalid"
    )
    expect(requiredLine("x".repeat(ID_MAX), ID_MAX, "actor")).toHaveLength(ID_MAX)
    for (const bad of [BELL, RLO, LINE_SEPARATOR, "\n"]) {
      expect(() => requiredLine(`usr${bad}01`, ID_MAX, "actor")).toThrow(
        "cp.ai_credit_actor_invalid"
      )
    }
    expect(optionalLine(null, REFERENCE_MAX, "reference")).toBeNull()
    expect(optionalLine(" ", REFERENCE_MAX, "reference")).toBeNull()
    expect(() => optionalLine("x".repeat(REFERENCE_MAX + 1), REFERENCE_MAX, "reference")).toThrow(
      "cp.ai_credit_reference_invalid"
    )
  })

  it("keeps a note's line breaks, refuses its other control characters and more than 500", () => {
    expect(noteOf(" iki\nsatır ", true)).toBe("iki\nsatır")
    expect(noteOf("  ", false)).toBeNull()
    expect(() => noteOf("  ", true)).toThrow("cp.ai_credit_note_required")
    expect(noteOf("x".repeat(NOTE_MAX), true)).toHaveLength(NOTE_MAX)
    expect(() => noteOf("x".repeat(NOTE_MAX + 1), true)).toThrow("cp.ai_credit_note_invalid")
    for (const bad of [BELL, RLO, LINE_SEPARATOR, "\r"]) {
      expect(() => noteOf(`no${bad}t`, true)).toThrow("cp.ai_credit_note_invalid")
    }
  })

  it("moves 1 to 1,000,000 credits at once, whole", () => {
    expect(movedCredits(1)).toBe(1)
    expect(movedCredits(1_000_000)).toBe(1_000_000)
    for (const bad of [0, -1, 1_000_001, 2 ** 31, 1.5, Number.NaN]) {
      expect(() => movedCredits(bad)).toThrow("cp.ai_credit_amount_invalid")
    }
  })

  it("takes a top-up's own reference in its shape, never the platform's prefixes", () => {
    expect(purchaseRef("EFT-2026.11:42_a")).toBe("EFT-2026.11:42_a")
    for (const reserved of ["plan:ten_1:2026-12", "adjust:x", "order:aiord_1", "ORDER:aiord_1"]) {
      expect(() => purchaseRef(reserved)).toThrow("cp.ai_credit_grant_ref_reserved")
    }
    for (const bad of ["", " eft", "eft 1", "eft/1", `eft${RLO}`, "x".repeat(REFERENCE_MAX + 1)]) {
      expect(() => purchaseRef(bad)).toThrow("cp.ai_credit_grant_ref_invalid")
    }
  })

  it("names a correction by its key, a UUID", () => {
    expect(adjustRef("3F2504E0-4F89-11D3-9A0C-0305E82C3301")).toBe(
      "adjust:3f2504e0-4f89-11d3-9a0c-0305e82c3301"
    )
    for (const bad of ["", "abc", "3f2504e0-4f89-11d3-9a0c-0305e82c3301x"]) {
      expect(() => adjustRef(bad)).toThrow("cp.ai_credit_key_invalid")
    }
  })
})
