import type { StorefrontFrame } from "@qticaret/types"

/**
 * The content pages with a role (adr/0047 contact form, adr/0046 Ek
 * 2026-11-05 payment and shipping facts), told by the page's id so a page
 * whose address changes keeps its role (adr/0073 Açık kararlar 3); by its
 * address only from a backend before the ids.
 */

/** A content page as its role is told: its record id and its address. */
export interface RolePage {
  id: string
  path: string
}

// A field absent: a backend before it
type Roles = Partial<
  Pick<
    StorefrontFrame,
    | "contact_page_id"
    | "payment_page_id"
    | "shipping_page_id"
    | "contact_form_path"
    | "payment_info_path"
    | "shipping_info_path"
  >
>

/** Whether the role names the page: by its id when the backend gives one, else by address. */
export function namesPage(
  page: RolePage,
  id: string | null | undefined,
  path: string | null | undefined
): boolean {
  if (id !== undefined) {
    return id !== null && id === page.id
  }
  return path !== undefined && path !== null && path === page.path
}

/** Whether the page carries the contact form. */
export const isContactPage = (page: RolePage, frame: Roles): boolean =>
  namesPage(page, frame.contact_page_id, frame.contact_form_path)

/** What a backend without the two settings meant: the addresses Turkish shops give these pages. */
const DEFAULT_INFO_PAGES = {
  payment_info_path: "/odeme-secenekleri",
  shipping_info_path: "/kargo-ve-teslimat",
} as const

/**
 * Whether a page is the shop's payment or shipping page, as the shop chose
 * them in its storefront settings. A setting saved as none names no page.
 */
export function infoPageOf(page: RolePage, frame: Roles): "payments" | "shipping" | null {
  const payments =
    frame.payment_info_path ??
    (frame.payment_info_path === undefined ? DEFAULT_INFO_PAGES.payment_info_path : null)
  const shipping =
    frame.shipping_info_path ??
    (frame.shipping_info_path === undefined ? DEFAULT_INFO_PAGES.shipping_info_path : null)
  if (namesPage(page, frame.payment_page_id, payments)) {
    return "payments"
  }
  return namesPage(page, frame.shipping_page_id, shipping) ? "shipping" : null
}
