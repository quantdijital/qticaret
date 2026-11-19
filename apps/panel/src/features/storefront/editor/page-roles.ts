import type { StorefrontSettings } from "@/features/settings/api/sections"
import { barePath } from "./editor-page"
import type { ContentPageOption } from "./use-content-pages"

/**
 * The content pages with a role on the storefront (adr/0047 contact form,
 * adr/0046 Ek 2026-11-05 payment and shipping facts), kept by the page's
 * id (adr/0073 Açık kararlar 3). A section saved before the ids names them
 * by path: read as the page at that address; the next save writes its id.
 */
export type PageRole = "contact" | "payment" | "shipping"

const FIELDS = {
  contact: { id: "contact_page_id", path: "contact_form_path" },
  payment: { id: "payment_page_id", path: "payment_info_path" },
  shipping: { id: "shipping_page_id", path: "shipping_info_path" },
} as const satisfies Record<
  PageRole,
  { id: keyof StorefrontSettings; path: keyof StorefrontSettings }
>

/** A role as saved: the page's id, else (saved before the ids) the old path. */
export interface RoleRef {
  id: string | null
  path: string | null
}

// A field absent: a section answered before it
type Saved = Partial<StorefrontSettings>

/** A role as the storefront section holds it. */
export function roleRef(saved: Saved, role: PageRole): RoleRef {
  const id = saved[FIELDS[role].id] ?? null
  return { id, path: id === null ? (saved[FIELDS[role].path] ?? null) : null }
}

/** Whether the role names the page: by its id, else by the old path. */
export const namesPage = (ref: RoleRef, page: Pick<ContentPageOption, "id" | "path">): boolean =>
  ref.id !== null
    ? ref.id === page.id
    : ref.path !== null && barePath(ref.path) === barePath(page.path)

/**
 * The role's page id as a picker shows it: the id saved; else the page at
 * the old path among the pages read; none while neither is known.
 */
export function rolePageId(
  saved: Saved,
  role: PageRole,
  pages: readonly ContentPageOption[] | undefined
): string | null {
  const ref = roleRef(saved, role)
  if (ref.id !== null) {
    return ref.id
  }
  return pages?.find((page) => namesPage(ref, page))?.id ?? null
}
