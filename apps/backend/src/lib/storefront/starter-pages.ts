import { storefrontSection } from "../../modules/platform-settings/sections/storefront"
import { PAGE_ROLES, ROLE_FIELDS, handleOfPath } from "./page-roles"
import type { PageRole } from "./page-roles"

/**
 * The content pages every shop starts with (adr/0073 Ek 2026-11-28):
 * Hakkımızda, İletişim, Sık Sorulan Sorular, Ödeme Seçenekleri, Kargo ve
 * Teslimat. Their text is the general pack's (`pages.json`), every look
 * lays them out and every pack offers them; each is opened as a **draft**
 * where the shop has no page at its address (K6 as it stands), never
 * written over. This is the one-off for shops from before them.
 */

/** A starter page as the general pack offers it. */
export interface StarterPage {
  handle: string
  title: string
  body: unknown
}

/** The handle each role's page has by default (`/iletisim` → `iletisim`). */
export function roleHandles(): Record<PageRole, string | null> {
  const defaults = storefrontSection.defaults as unknown as Record<string, unknown>
  const handleOf = (role: PageRole): string | null => {
    const path = defaults[ROLE_FIELDS[role].path]
    return typeof path === "string" ? handleOfPath(path) : null
  }
  return {
    contact: handleOf("contact"),
    payment: handleOf("payment"),
    shipping: handleOf("shipping"),
  }
}

/** What the shop already has that a starter page must not stand beside. */
export interface StarterFacts {
  /** The handles of the content pages the shop has (any status). */
  pages: ReadonlySet<string>
  /** The handle of the page each role names now; none: the role has no page. */
  roles: Readonly<Record<PageRole, string | null>>
}

export interface StarterPlan {
  open: StarterPage[]
  /** A page at the address already: the shop's, kept. */
  kept: string[]
  /** A role page's starter whose role another of the shop's pages holds. */
  role_held: string[]
}

/**
 * Which starter pages to open (pure): one whose address a page of the
 * shop's has is kept; a role's starter (İletişim at the contact role's
 * default address…) is left when the role already names another page of
 * the shop's, so no second contact page is opened beside it.
 */
export function planStarterPages(
  starters: readonly StarterPage[],
  facts: StarterFacts,
  defaults: Readonly<Record<PageRole, string | null>> = roleHandles()
): StarterPlan {
  const plan: StarterPlan = { open: [], kept: [], role_held: [] }
  for (const page of starters) {
    if (facts.pages.has(page.handle)) {
      plan.kept.push(page.handle)
      continue
    }
    const role = PAGE_ROLES.find((each) => defaults[each] === page.handle)
    const held = role ? facts.roles[role] : null
    if (held !== null && held !== page.handle) {
      plan.role_held.push(page.handle)
      continue
    }
    plan.open.push(page)
  }
  return plan
}

/**
 * The starter pages a shop gets: the general pack's, each as the shop's own
 * sector pack writes it (a tour shop's questions are its own) and only the
 * ones that pack offers (a tour shop has no shipping page, owner
 * 2026-11-28); a shop with no sector pack, or one offering no pages, the
 * general pack's.
 */
export function startersFor(
  general: readonly StarterPage[],
  sector: readonly { pages?: readonly StarterPage[] | undefined }[]
): StarterPage[] {
  const own = sector.find((pack) => (pack.pages ?? []).length > 0)?.pages
  if (!own) {
    return [...general]
  }
  return general.flatMap((page) => {
    const mine = own.find((each) => each.handle === page.handle)
    return mine ? [mine] : []
  })
}
