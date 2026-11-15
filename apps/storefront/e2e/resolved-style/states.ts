import type { Locator, Page } from "@playwright/test"

/**
 * Interactive states applied after a page loads, each captured on its own
 * (adr/0067 §1: `menu_style`, `shadow` and `chip_style` draw exactly these).
 * Found by role and accessible name, the way a visitor finds them, never by
 * class. A state whose control the page does not draw (another header
 * format, no products) is skipped with its reason, not an error.
 */
export interface StyleState {
  name: string
  /** The pages it is applied on (their names in the page list). */
  pages: string[]
  /** The widths it is applied at; all for none. */
  widths?: number[]
  /** Brings the page into the state; returns why it cannot, or null when it did. */
  apply: (page: Page) => Promise<string | null>
}

const DESKTOP = [1440]
const PHONE = [390]
const WAIT = 3_000

/** The first of these that is drawn, or null. */
async function firstVisible(locator: Locator): Promise<Locator | null> {
  const count = await locator.count()
  for (let i = 0; i < count; i += 1) {
    const each = locator.nth(i)
    if (await each.isVisible()) {
      return each
    }
  }
  return null
}

/** The header's main menu: of its navigation landmarks, the one with the most links and buttons. */
async function headerMenu(page: Page): Promise<Locator | null> {
  const navs = page.getByRole("banner").getByRole("navigation")
  let best: Locator | null = null
  let most = 0
  for (let i = 0; i < (await navs.count()); i += 1) {
    const nav = navs.nth(i)
    if (!(await nav.isVisible())) {
      continue
    }
    const items = await nav.locator("a, button").count()
    if (items > most) {
      most = items
      best = nav
    }
  }
  return best
}

async function hover(target: Locator | null, missing: string): Promise<string | null> {
  if (!target) {
    return missing
  }
  await target.scrollIntoViewIfNeeded({ timeout: WAIT })
  await target.hover({ timeout: WAIT })
  return null
}

/** Clicks and waits for the dialog (or popup) it opens; a click that leaves the page is not a state. */
async function open(page: Page, target: Locator | null, missing: string): Promise<string | null> {
  if (!target) {
    return missing
  }
  const before = page.url()
  await target.click({ timeout: WAIT })
  await page.waitForTimeout(300)
  if (page.url() !== before) {
    return "the control went to another page instead of opening a panel"
  }
  return null
}

export const STATES: StyleState[] = [
  {
    name: "menu-hover",
    pages: ["home"],
    widths: DESKTOP,
    apply: async (page) => {
      const menu = await headerMenu(page)
      return hover(menu && (await firstVisible(menu.locator("a, button"))), "no header menu")
    },
  },
  {
    name: "menu-open",
    pages: ["home"],
    widths: DESKTOP,
    apply: async (page) => {
      const menu = await headerMenu(page)
      const trigger = menu && (await firstVisible(menu.locator('button[aria-expanded="false"]')))
      return open(page, trigger, "no menu item that opens a list")
    },
  },
  {
    name: "categories-open",
    pages: ["home"],
    widths: DESKTOP,
    apply: async (page) =>
      open(
        page,
        await firstVisible(page.getByRole("banner").getByRole("button", { name: /^Kategoriler/i })),
        'no "Kategoriler" button'
      ),
  },
  {
    name: "phone-menu",
    pages: ["home"],
    widths: PHONE,
    apply: async (page) =>
      open(
        page,
        await firstVisible(page.getByRole("banner").getByRole("button", { name: /men[üu]/i })),
        "no menu button"
      ),
  },
  {
    name: "cart-drawer",
    pages: ["home"],
    apply: async (page) =>
      open(
        page,
        await firstVisible(page.getByRole("banner").getByRole("link", { name: /^Sepet/i })),
        "no cart link"
      ),
  },
  {
    name: "search-panel",
    pages: ["home"],
    apply: async (page) => {
      const banner = page.getByRole("banner")
      // A header that draws the search field: focused, with the suggestions
      // for the first word of the first product card (a GET, as typing makes it)
      const field = await firstVisible(
        banner.getByRole("searchbox").or(banner.getByRole("combobox"))
      )
      if (field) {
        const card = await firstVisible(page.getByRole("main").locator('a[href*="/urun/"]'))
        const word = /\p{L}{3,}/u.exec((await card?.textContent()) ?? "")?.[0] ?? ""
        const why = await open(page, field, "")
        if (!why && word) {
          await field.pressSequentially(word.toLocaleLowerCase("tr"), { timeout: WAIT })
          // The suggestions come debounced: their list, then their pictures
          await page
            .getByRole("listbox")
            .first()
            .waitFor({ timeout: 5_000 })
            .catch(() => undefined)
          await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined)
          await page.waitForTimeout(300)
        }
        return why
      }
      // Else the button that opens a search panel (a form's submit would leave the page: skipped)
      return open(
        page,
        await firstVisible(banner.getByRole("button", { name: /^Ara/i })),
        "no search field or button"
      )
    },
  },
  {
    name: "card-hover",
    pages: ["home", "category"],
    apply: async (page) =>
      hover(
        await firstVisible(page.getByRole("main").locator('a[href*="/urun/"]')),
        "no product card"
      ),
  },
]
