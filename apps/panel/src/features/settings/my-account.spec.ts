import { describe, expect, it } from "vitest"
import { fullNameOf, initialsOf, newPasswordIssue } from "./my-account"

const profile = {
  id: "user_1",
  email: "elif@ornek.com",
  first_name: "elif",
  last_name: "Işık",
  job_title: null,
  role: "operations" as const,
  created_at: "2026-10-01T09:00:00.000Z",
}

describe("the member's own account", () => {
  it("names the member, and falls back to the address without a name", () => {
    expect(fullNameOf(profile)).toBe("elif Işık")
    expect(fullNameOf({ ...profile, first_name: null, last_name: " " })).toBe("elif@ornek.com")
  })

  it("takes the avatar's letters in Turkish case", () => {
    expect(initialsOf(profile)).toBe("EI")
    expect(initialsOf({ ...profile, first_name: "irem", last_name: null })).toBe("İ")
    expect(initialsOf({ ...profile, first_name: "ışıl", last_name: null })).toBe("I")
    expect(initialsOf({ ...profile, first_name: null, last_name: null })).toBe("E")
  })

  it("says a new password's own mistake before the server is asked", () => {
    const current = "eski şifrem burada"
    expect(newPasswordIssue({ current, next: "kısa", repeat: "kısa" })).toBe("short")
    expect(newPasswordIssue({ current, next: "x".repeat(257), repeat: "" })).toBe("long")
    expect(newPasswordIssue({ current, next: current, repeat: current })).toBe("same")
    expect(
      newPasswordIssue({ current, next: "yeni ve uzun parola", repeat: "yeni ve uzun parol" })
    ).toBe("mismatch")
    expect(
      newPasswordIssue({ current, next: "yeni ve uzun parola", repeat: "yeni ve uzun parola" })
    ).toBeNull()
  })
})
