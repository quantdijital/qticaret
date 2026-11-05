import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { AuthActions } from "@qticaret/ui"
import { authView } from "@/lib/views/account"
import { renderPage } from "@/test/theme-render"

/**
 * The theme's order lookup without an account (`/siparis`, design.md §
 * Satın alma sayfaları): the order number and the e-mail the link goes
 * to, and the shop's carriers' own tracking pages for a tracking number.
 */

describe("the theme's order lookup", () => {
  const auth: AuthActions = {
    login: () => Promise.resolve({ ok: true, error: null, challenge: null }),
    register: () => Promise.resolve({ ok: true, error: null, challenge: null }),
    forgot: () => Promise.resolve({ ok: true, error: null, challenge: null }),
    reset: () => Promise.resolve({ ok: true, error: null, challenge: null }),
    verify: () => Promise.resolve({ ok: true, error: null, challenge: null }),
    lookup: () => Promise.resolve({ ok: true, error: null, challenge: null }),
  }

  it("asks the order number and the e-mail, and lists the carriers' tracking pages", () => {
    const html = renderPage(atolyeTheme, "AuthPage", {
      view: {
        ...authView("lookup"),
        carriers: [{ label: "Aras Kargo", path: "https://kargotakip.araskargo.com.tr/" }],
      },
      actions: auth,
    })
    expect(html).toMatch(/<h1[^>]*>Siparişimi bul<\/h1>/)
    expect(html).toContain('name="display_id"')
    expect(html).toContain('name="email"')
    expect(html).toContain('href="https://kargotakip.araskargo.com.tr/"')
  })

  it("keeps the order fields off the other sign-in pages", () => {
    const html = renderPage(atolyeTheme, "AuthPage", { view: authView("login"), actions: auth })
    expect(html).toContain('name="password"')
    expect(html).not.toContain('name="display_id"')
  })
})
