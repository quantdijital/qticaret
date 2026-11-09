import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { AuthActions, AuthPageView } from "@qticaret/ui"
import { t } from "@/lib/i18n"

/**
 * What scrolls with nothing in it to focus takes the focus itself,
 * labelled, so a keyboard reaches and scrolls it (WCAG 2.1.1, axe
 * scrollable-region-focusable at 390 px). The base theme's gallery and
 * banner row cases went with that theme (adr/0057 Ek 2026-11-09).
 */

// An element's opening tag, found by its label
const openingTag = (html: string, label: string) =>
  new RegExp(`<[a-z]+ [^>]*aria-label="${label}"[^>]*>`).exec(html)?.[0] ?? null

const refusedAuth = () => Promise.resolve({ ok: false, error: null, challenge: null })
const authActions: AuthActions = {
  login: refusedAuth,
  register: refusedAuth,
  forgot: refusedAuth,
  reset: refusedAuth,
  verify: refusedAuth,
  lookup: refusedAuth,
}

describe("the membership text on the register page", () => {
  it("scrolls in a labelled box the keyboard reaches", () => {
    const view: AuthPageView = {
      mode: "register",
      notice: null,
      email: null,
      token: null,
      needsPassword: false,
      terms: { kind: "membership", version: 1, title: "Üyelik sözleşmesi", html: "<p>Madde 1</p>" },
      next: null,
      invite: null,
      links: { login: "/hesap/giris", register: "/hesap/kayit", forgot: "/hesap/sifre-sifirla" },
    }
    const html = renderToStaticMarkup(
      createElement(atolyeTheme.AuthPage, { t, view, actions: authActions })
    )
    const box = openingTag(html, "Üyelik sözleşmesi")
    expect(box).toContain('role="region"')
    expect(box).toContain('tabindex="0"')
    expect(box).toContain("overflow-y-auto")
  })
})
