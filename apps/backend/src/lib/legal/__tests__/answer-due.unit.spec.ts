import { PRIVACY_ANSWER_DAYS, privacyAnswerDue, privacyAnswerDueText } from "../answer-due"

/** KVKK md. 13 (adr/0041 §6): thirty days to answer, from the day the request came. */
describe("privacyAnswerDue", () => {
  it("is thirty days after the request came", () => {
    expect(PRIVACY_ANSWER_DAYS).toBe(30)
    expect(privacyAnswerDue(new Date("2026-11-02T09:30:00Z")).toISOString()).toBe(
      "2026-12-02T09:30:00.000Z"
    )
  })

  it("names the day in the shop's own time zone", () => {
    // 22:30 UTC is already the next day in Istanbul
    expect(privacyAnswerDueText(new Date("2026-11-02T22:30:00Z"), "Europe/Istanbul")).toBe(
      "3 Aralık 2026"
    )
    expect(privacyAnswerDueText(new Date("2026-11-02T22:30:00Z"), "UTC")).toBe("2 Aralık 2026")
  })
})
