import { OPEN_TEMPLATES } from "../email/quota"
import { EDITABLE_TEMPLATES } from "../editable/registry"
import { MESSAGE_TEMPLATES } from "../templates"
import type { Brand } from "../templates"

const brand: Brand = {
  shopName: "Atölye",
  logoUrl: null,
  color: "#2f6feb",
  contactEmail: null,
  contactPhone: null,
  storefrontUrl: "https://magaza.example",
}

/** ADR-0068 §3: a wholesaler invited, an existing customer made one. */
describe("wholesale account messages", () => {
  const invite = MESSAGE_TEMPLATES["account.wholesale_invite"]
  const enabled = MESSAGE_TEMPLATES["account.wholesale_enabled"]

  it("are transactional e-mails staff send: the transactional day, not the open share", () => {
    for (const template of [invite, enabled]) {
      expect(template.kind).toBe("transactional")
      expect(template.channels).toEqual(["email"])
      expect(OPEN_TEMPLATES).not.toContain(template.name)
    }
  })

  it("invites to the sign-up page with the invitation's last day, no password, no address", () => {
    const mail = invite.email?.(
      { registerUrl: "https://magaza.example/hesap/kayit", expiresAt: "13 Şubat 2027" },
      brand
    )
    expect(mail?.subject).toBe("Atölye toptan hesabınız hazır")
    expect(mail?.html).toContain('href="https://magaza.example/hesap/kayit"')
    expect(mail?.text).toContain("13 Şubat 2027")
    expect(mail?.text).toContain("bu e-postanın geldiği adresle")
    expect(mail?.text.toLowerCase()).not.toContain("şifreniz:")
  })

  it("tells an existing customer to sign in", () => {
    const mail = enabled.email?.({ loginUrl: "https://magaza.example/hesap/giris" }, brand)
    expect(mail?.subject).toBe("Atölye toptan hesabınız açıldı")
    expect(mail?.html).toContain('href="https://magaza.example/hesap/giris"')
  })

  it("may be reworded or turned off by the shop, in the account group", () => {
    const names = EDITABLE_TEMPLATES.filter((template) => template.editable.group === "account")
      .filter((template) => !template.editable.required)
      .map((template) => template.name)
    expect(names).toEqual(
      expect.arrayContaining(["account.wholesale_invite", "account.wholesale_enabled"])
    )
  })
})
