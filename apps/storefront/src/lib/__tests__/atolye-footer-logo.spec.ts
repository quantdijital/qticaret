import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { FooterBarView, ImageView } from "@qticaret/ui"
import { renderFrame, shopFixture } from "@/test/theme-render"

/**
 * Atölye's footer names the shop by the store profile's logo when it has
 * one, as the header does (owner 2026-11-16), else by its name as before:
 * the image in the contact's heading, its alt text the heading's name, in
 * the header logo's 40 px box.
 */

const BAR: FooterBarView = { id: "mainfooter", variant: "ledger" }

const LOGO: ImageView = {
  src: "/media/logo.svg",
  alt: "Örnek Bıçak",
  width: 240,
  height: 60,
  sources: { avif: null, webp: null },
}

const heading = (footerBar: FooterBarView | undefined) => {
  const shop = shopFixture()
  const html = renderFrame(atolyeTheme, {
    ...shop,
    name: "Örnek Bıçak",
    ...(footerBar ? { footerBar } : {}),
  })
  return /<h2 id="footer-contact"[\s\S]*?<\/h2>/.exec(html)?.[0] ?? ""
}

describe("the footer's brand (owner 2026-11-16)", () => {
  it("writes the name as before when the shop has no logo", () => {
    const before =
      '<h2 id="footer-contact" class="text-wordmark leading-tight font-extrabold tracking-(--tracking-display)">Örnek Bıçak</h2>'
    expect(heading(BAR)).toBe(before)
    expect(heading(undefined)).toBe(before)
  })

  it("draws the store profile's logo in the heading, named by its alt text, its size kept", () => {
    const html = heading({ ...BAR, logo: LOGO })
    expect(html).toMatch(/^<h2 id="footer-contact" class="flex min-h-11 items-center">/)
    expect(html).toMatch(
      /<img src="\/media\/logo\.svg" alt="Örnek Bıçak" width="240" height="60" loading="lazy"[^>]*class="h-10 w-auto max-w-56 object-contain object-left"/
    )
    // No second name beside it: the image is the heading's text
    expect(html).not.toContain(">Örnek Bıçak<")
  })
})
