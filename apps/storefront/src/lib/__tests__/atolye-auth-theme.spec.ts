import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { AuthActions } from "@qticaret/ui"
import { t } from "@/lib/i18n"
import { authView } from "@/lib/views/account"
import { renderPage } from "@/test/theme-render"
import { firstAuthProblem } from "../../../../../packages/themes/atolye/src/account/auth-check"

/**
 * The theme's sign-in pages (design.md § Hesap): one panel, a graphite
 * side and the form's well, with the storefront's field names and
 * handlers kept, and the forms' own first look in the browser.
 */

const answer = () => Promise.resolve({ ok: true, error: null, challenge: null })
const auth: AuthActions = {
  login: answer,
  register: answer,
  forgot: answer,
  reset: answer,
  verify: answer,
  lookup: answer,
}

describe("the theme's sign-in pages", () => {
  it("signs in with the e-mail and a password that can be shown, the reset under it", () => {
    const html = renderPage(atolyeTheme, "AuthPage", { view: authView("login"), actions: auth })
    expect(html).toMatch(/<h1[^>]*>Giriş yap<\/h1>/)
    expect(html).toContain('name="email"')
    expect(html).toContain('name="password"')
    expect(html).toContain('aria-controls="password"')
    expect(html).toContain('aria-label="Şifreyi göster"')
    expect(html).toContain('href="/hesap/sifre-sifirla"')
    expect(html).toContain('href="/hesap/kayit"')
    expect(html).toContain('href="/siparis"')
  })

  it("registers with the action's fields, the membership text to accept and the KVKK notice", () => {
    const html = renderPage(atolyeTheme, "AuthPage", {
      view: authView("register", {
        terms: { kind: "membership", version: 3, title: "Üyelik Sözleşmesi", html: "<p>Metin</p>" },
        privacyPath: "/yasal/kvkk-aydinlatma-metni",
        invite: "davet-1",
      }),
      actions: auth,
    })
    for (const name of ["first_name", "last_name", "email", "phone", "password", "accept"]) {
      expect(html).toContain(`name="${name}"`)
    }
    expect(html).toContain('name="terms" value="1"')
    expect(html).toContain('name="davet" value="davet-1"')
    expect(html).toContain('autoComplete="new-password"')
    expect(html).toContain('href="/yasal/kvkk-aydinlatma-metni"')
    expect(html).toContain("Üyelik Sözleşmesi")
    expect(html).toContain(t("account.perk_favorites"))
  })

  it("asks a new link instead of a password when the reset link has no key", () => {
    const html = renderPage(atolyeTheme, "AuthPage", {
      view: authView("reset", { notice: t("account.reset_link_invalid") }),
      actions: auth,
    })
    expect(html).not.toContain('name="password"')
    expect(html).toContain('role="alert"')
    expect(html).toMatch(/href="\/hesap\/sifre-sifirla"[^>]*>Yeni bağlantı isteyin/)
  })

  it("verifies with the link's code, the password only when this browser lost the login", () => {
    const quick = renderPage(atolyeTheme, "AuthPage", {
      view: authView("verify", { token: "kod-1234567890" }),
      actions: auth,
    })
    expect(quick).toContain('value="kod-1234567890"')
    expect(quick).not.toContain('name="password"')
    const again = renderPage(atolyeTheme, "AuthPage", {
      view: authView("verify", { needsPassword: true }),
      actions: auth,
    })
    expect(again).toContain('name="email"')
    expect(again).toContain('name="password"')
  })
})

describe("the sign-in forms' first look", () => {
  it("says the first wrong field in the form's order", () => {
    expect(
      firstAuthProblem({ first_name: "", last_name: "", email: "", password: "" }, "register")
    ).toEqual({ field: "first_name", error: "checkout.name_required" })
    expect(firstAuthProblem({ email: "elif@", password: "x" }, "login")).toEqual({
      field: "email",
      error: "checkout.email_invalid",
    })
    expect(firstAuthProblem({ email: "elif@example.com", password: "" }, "login")).toEqual({
      field: "password",
      error: "account.password_required",
    })
  })

  it("asks ten characters of a new password only, a mobile only when given, the box when asked", () => {
    const base = { first_name: "Elif", last_name: "Yıldız", email: "elif@example.com" }
    expect(firstAuthProblem({ ...base, phone: "", password: "kisa" }, "register")?.error).toBe(
      "auth.password_too_short"
    )
    expect(firstAuthProblem({ email: "elif@example.com", password: "kisa" }, "login")).toBeNull()
    expect(
      firstAuthProblem({ ...base, phone: "0212 000 00 00", password: "uzun-bir-sifre" }, "register")
        ?.field
    ).toBe("phone")
    expect(
      firstAuthProblem({ ...base, phone: "", password: "uzun-bir-sifre", terms: "1" }, "register")
    ).toEqual({ field: "accept", error: "account.terms_required" })
    expect(
      firstAuthProblem(
        { ...base, phone: "0532 123 45 67", password: "uzun-bir-sifre", terms: "1", accept: "on" },
        "register"
      )
    ).toBeNull()
  })
})

describe("the register page's KVKK notice", () => {
  it("passes the notice's page through the view, and none when not given", () => {
    expect(authView("register", { privacyPath: "/yasal/kvkk-aydinlatma-metni" }).privacyPath).toBe(
      "/yasal/kvkk-aydinlatma-metni"
    )
    expect(authView("login")).not.toHaveProperty("privacyPath")
  })
})
