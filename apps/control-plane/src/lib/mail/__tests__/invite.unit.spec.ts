import { inviteEmail, inviteLink } from "../invite"
import { headerText } from "../transport"

describe("invitation e-mail", () => {
  it("puts the token after # so no access log or Referer sees it", () => {
    const link = inviteLink("tok.en-1", "https://ust.example.com/")

    expect(link).toBe("https://ust.example.com/invite#token=tok.en-1")
  })

  it("names the role and escapes the link in HTML", () => {
    const email = inviteEmail("a@quant.test", "finance", 'https://x.test/invite#token=a"<b>')

    expect(email.text).toContain("finans")
    expect(email.html).not.toContain('"<b>')
    expect(email.html).toContain("&quot;&lt;b&gt;")
    expect(email.template).toBe("cp.staff_invite")
  })

  it("keeps a header on one line, without invisible characters", () => {
    expect(headerText("a\r\nBcc: x@y‮", 100)).toBe("a Bcc: x@y")
  })
})
