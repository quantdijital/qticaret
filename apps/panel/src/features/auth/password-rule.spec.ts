import { describe, expect, it } from "vitest"
import { passwordRuleText } from "./password-rule"

describe("passwordRuleText", () => {
  it("finds the rule's key in `code`, an invite's key or `message`", () => {
    expect(passwordRuleText({ code: "auth.password_common", message: "Bu şifre çok yaygın" })).toBe(
      "passwordRule.common"
    )
    expect(passwordRuleText({ key: "auth.password_breached" })).toBe("passwordRule.breached")
    expect(passwordRuleText({ message: "auth.password_too_short" })).toBe("passwordRule.too_short")
  })

  it("leaves any other failure to the page", () => {
    expect(passwordRuleText({ message: "Unauthorized" })).toBeNull()
    expect(passwordRuleText({ message: "auth.password_unknown" })).toBeNull()
    expect(passwordRuleText(null)).toBeNull()
  })
})
