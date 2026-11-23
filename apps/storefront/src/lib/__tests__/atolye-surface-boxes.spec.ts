import { describe, expect, it } from "vitest"
import { atolyeCss } from "@/test/atolye-css"
import { buildAtolyeCss } from "@/test/tailwind-build"

/**
 * The theme's other boxes (adr/0067 step 4): the account, order, checkout,
 * payment link and content pages' and the home sections' boxes moved from
 * their utilities onto `gf-pane` (a box on its ground) and `gf-pane-inner`
 * (a box inside one). `filled` must draw them exactly as before; the
 * checks read the stylesheet as Tailwind builds it, layers and all.
 */

/** Each moved file: how many `gf-pane` and `gf-pane-inner` it writes. */
const MOVED: Record<string, [pane: number, inner: number]> = {
  "BrandsPage.tsx": [2, 0],
  "CategoriesPage.tsx": [1, 0],
  "ConfirmPage.tsx": [1, 0],
  "CookiePreferencesPage.tsx": [2, 1],
  "GiftCardBalancePage.tsx": [1, 0],
  "LegalPage.tsx": [2, 0],
  "PaymentLinkPage.tsx": [3, 0],
  "account/AccountNav.tsx": [2, 0],
  "account/AccountPage.tsx": [1, 0],
  "account/Addresses.tsx": [3, 1],
  "account/AuthForm.tsx": [1, 2],
  "account/AuthPage.tsx": [1, 1],
  "account/BillingForm.tsx": [0, 1],
  "account/Favorites.tsx": [1, 0],
  "account/LookupPage.tsx": [1, 1],
  "account/Orders.tsx": [2, 0],
  "account/Profile.tsx": [1, 2],
  "account/ProfileForms.tsx": [0, 1],
  "cart/AddonEditor.tsx": [0, 1],
  "cart/CartPage.tsx": [2, 0],
  "cart/GiftRecipient.tsx": [0, 1],
  "checkout/CheckoutPage.tsx": [1, 2],
  "checkout/CheckoutResultPage.tsx": [1, 0],
  "checkout/Consents.tsx": [1, 1],
  "checkout/PaymentFramePage.tsx": [1, 0],
  "checkout/ShippingForm.tsx": [0, 1],
  "checkout/Step.tsx": [1, 0],
  "content/Author.tsx": [1, 0],
  "content/BlogIndexPage.tsx": [1, 0],
  "content/ContactBody.tsx": [1, 0],
  "content/ContactForm.tsx": [1, 0],
  "content/Facts.tsx": [3, 0],
  "content/FaqBody.tsx": [1, 0],
  "content/Outline.tsx": [1, 0],
  "content/ReviewsPage.tsx": [2, 0],
  "order/OrderAside.tsx": [1, 1],
  "order/OrderPage.tsx": [3, 1],
  "order/OrderParts.tsx": [2, 1],
  "order/OrderReturns.tsx": [1, 0],
  "order/Progress.tsx": [1, 1],
  "order/ReturnForm.tsx": [0, 2],
  "payment-link/LinkLines.tsx": [0, 2],
  "sections/Faq.tsx": [1, 0],
  "sections/GoogleRating.tsx": [1, 0],
  "sections/Guides.tsx": [1, 0],
  "sections/ShelfRack.tsx": [1, 0],
  "sections/Signup.tsx": [1, 0],
  // adr/0073 §3: the pane and "Görselli metin"'s pane
  "sections/Story.tsx": [2, 0],
}

/** The at-rules around a rule, outermost first, and its body. */
function find(css: string, selector: string): { around: string[]; body: string } {
  const start = css.indexOf(`\n${selector} {`) + 1 || css.indexOf(`  ${selector} {`) + 2
  if (start < 2) {
    throw new Error(`no rule for ${selector}`)
  }
  const around: string[] = []
  let head = 0
  for (let at = 0; at < start; at++) {
    const char = css[at]
    if (char === "{") {
      around.push(css.slice(head, at).trim())
      head = at + 1
    } else if (char === "}") {
      around.pop()
      head = at + 1
    } else if (char === ";") {
      head = at + 1
    }
  }
  const open = css.indexOf("{", start)
  return { around, body: css.slice(open + 1, css.indexOf("}", open)).trim() }
}

const count = (source: string, name: string) =>
  (source.match(new RegExp(`(?<![\\w-])${name}(?![\\w-])`, "g")) ?? []).length

describe("the theme's other boxes (adr/0067 step 4)", () => {
  it("draws a moved box filled exactly as the utility it replaced", async () => {
    const css = await buildAtolyeCss(["bg-paper-2", "bg-field"])
    for (const [recipe, utility] of [
      [".gf-pane", ".bg-paper-2"],
      [".gf-pane-inner", ".bg-field"],
    ] as const) {
      const moved = find(css, recipe)
      const before = find(css, utility)
      expect(moved.body, recipe).toBe(before.body)
      expect(moved.around, recipe).toEqual(["@layer components"])
      expect(before.around, utility).toEqual(["@layer utilities"])
    }
    // Every utility a box also carries (a hover tone, `lg:bg-transparent`) still wins over it
    expect(css).toContain("@layer theme, base, components, utilities;")
  })

  it("keeps a control's hover a step darker on a moved box", async () => {
    const css = await buildAtolyeCss([])
    expect(css).toContain(":is(.bg-paper-2, .gf-pane, .bg-media) .gf-icon-btn:hover")
    expect(css).toContain(":is(.bg-field, .gf-pane-inner) .gf-icon-btn:hover:not(:disabled)")
  })

  it("draws a box lined on its section's own ground and rule, under every utility it carries", async () => {
    const css = await buildAtolyeCss([])
    const lined = find(css, '[data-surface="lined"] .gf-pane')
    expect(lined.around).toEqual(["@layer components"])
    expect(lined.body).toContain("background-color: var(--color-paper);")
    expect(lined.body).toContain("box-shadow: inset 0 0 0 1px var(--color-rule);")
    // Not `--box-ground`/`--box-line`: those resolve on `:root`, the page's light paper
    expect(lined.body).not.toContain("--box-")
    // Graphite and the shop's colour turn those two tokens for the section inside
    const look = atolyeCss("look.css")
    for (const ground of ["stage", "primary"]) {
      const tokens = find(look, `:is(.gf-look, .gf-ground)[data-ground="${ground}"] > *`).body
      expect(tokens, ground).toMatch(/--color-paper: /)
      expect(tokens, ground).toMatch(/--color-rule: /)
    }
  })

  it("draws a box inside a lined box without a rule of its own: no double line", async () => {
    const css = await buildAtolyeCss([])
    expect(find(css, '[data-surface="lined"] .gf-pane-inner').body).toBe(
      "background-color: var(--color-paper-2);"
    )
    const nested = find(css, '[data-surface="lined"] :is(.gf-pane, .gf-box) .gf-pane')
    expect(nested.around).toEqual(["@layer components"])
    expect(nested.body).toContain("box-shadow: none;")
    // A contract's text in its fold (third level) back on the field, written after
    const third = '[data-surface="lined"] .gf-pane-inner .gf-pane'
    expect(find(css, third).body).toBe("background-color: var(--color-field);")
    expect(css.indexOf(`${third} {`)).toBeGreaterThan(
      css.indexOf(":is(.gf-pane, .gf-box) .gf-pane {")
    )
    // A control on an inner box, now on the tone, still answers a step darker
    expect(css).toContain('[data-surface="lined"] .gf-pane-inner .gf-icon-btn:hover:not(:disabled)')
  })

  it("keeps a shape inside a lined box apart from the box's ground", async () => {
    const css = await buildAtolyeCss(["bg-paper", "bg-paper-2", "bg-field", "ring-paper-2"])
    // A disc or a pill drawn in the paper or the field would vanish into a ruled box's paper
    const inBox = find(css, '[data-surface="lined"] :is(.gf-pane, .gf-box) .gf-shape')
    expect(inBox.body).toBe("background-color: var(--color-paper-2);")
    // In a box inside one (the tone) a pill drawn in the tone steps back to the paper, written after
    const inInner = '[data-surface="lined"] .gf-pane-inner .gf-shape'
    expect(find(css, inInner).body).toBe("background-color: var(--color-paper);")
    expect(css.indexOf(`${inInner} {`)).toBeGreaterThan(
      css.indexOf(":is(.gf-pane, .gf-box) .gf-shape {")
    )
    // Unlayered: the shape's own colour is a utility, which a layered rule could not outrank
    expect(inBox.around).toEqual([])
    expect(find(css, inInner).around).toEqual([])
    // An order row's thumbnails are ringed in the row's ground
    const ring = find(css, '[data-surface="lined"] .gf-pane .ring-paper-2')
    expect(ring.around).toEqual([])
    expect(ring.body).toBe("--tw-ring-color: var(--color-paper);")
    // Nothing at `filled`: no rule names the shape without the lined mark
    expect(css.match(/[^\n]*\.gf-shape[^\n]*\{/g)?.every((rule) => rule.includes("lined"))).toBe(
      true
    )
  })

  it("marks every shape a box draws on its ground", () => {
    const SHAPES: Record<string, number> = {
      "PaymentLinkPage.tsx": 1,
      "account/AccountNav.tsx": 2,
      "account/Favorites.tsx": 1,
      "account/Orders.tsx": 2,
      "account/Profile.tsx": 1,
      "cart/CartPage.tsx": 1,
      "checkout/CheckoutResultPage.tsx": 1,
      "content/Facts.tsx": 1,
    }
    for (const [file, shapes] of Object.entries(SHAPES)) {
      expect(count(atolyeCss(file), "gf-shape"), file).toBe(shapes)
    }
  })

  it("moved every listed box off its utility", () => {
    for (const [file, [pane, inner]] of Object.entries(MOVED)) {
      const source = atolyeCss(file)
      expect(count(source, "gf-pane"), file).toBe(pane)
      expect(count(source, "gf-pane-inner"), file).toBe(inner)
      // No box left on the old tone: a rounded box on `bg-paper-2` is a photo well or a skeleton only
      expect(source, file).not.toMatch(/rounded-(media|tile) bg-paper-2 p-/)
    }
  })
})
