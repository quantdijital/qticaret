import { pagePath } from "../seo"

/**
 * The content pages with a role on the storefront (adr/0047 contact form,
 * adr/0046 Ek 2026-11-05 payment and shipping facts), kept by the page's
 * id so a page whose address changes keeps its role (adr/0073 Açık
 * kararlar 3). A section saved before the ids names them by path: read as
 * the page at that address until a save writes its id.
 */
export const PAGE_ROLES = ["contact", "payment", "shipping"] as const
export type PageRole = (typeof PAGE_ROLES)[number]

/** Each role's two fields in the storefront section: the page's id, and the old path. */
export const ROLE_FIELDS = {
  contact: { id: "contact_page_id", path: "contact_form_path" },
  payment: { id: "payment_page_id", path: "payment_info_path" },
  shipping: { id: "shipping_page_id", path: "shipping_info_path" },
} as const satisfies Record<PageRole, { id: string; path: string }>

/** A content page (`kind: page`) as a role reads it. */
export interface RolePage {
  id: string
  handle: string
  status: string
}

/** A role as stored: the page's id, else an old path. */
export interface RoleRef {
  id: string | null
  path: string | null
}

type Fields = Readonly<Record<string, unknown>>

const textOrNull = (value: unknown): string | null =>
  typeof value === "string" && value !== "" ? value : null

/** A role as the section's values hold it. */
export const roleRef = (values: Fields, role: PageRole): RoleRef => ({
  id: textOrNull(values[ROLE_FIELDS[role].id]),
  path: textOrNull(values[ROLE_FIELDS[role].path]),
})

/** Every role as the section's values hold it. */
export const roleRefs = (values: Fields): Record<PageRole, RoleRef> => ({
  contact: roleRef(values, "contact"),
  payment: roleRef(values, "payment"),
  shipping: roleRef(values, "shipping"),
})

/** The handle a content page's path names (`/iletisim` → `iletisim`); none for a deeper path. */
export function handleOfPath(path: string): string | null {
  const bare = path.trim().toLowerCase().replace(/^\/+/, "").replace(/\/+$/, "")
  return bare !== "" && !bare.includes("/") ? bare : null
}

/** What finding the roles' pages needs: the ids named, and the handles old paths name. */
export function roleLookups(refs: Readonly<Record<PageRole, RoleRef>>): {
  ids: string[]
  handles: string[]
} {
  const all = PAGE_ROLES.map((role) => refs[role])
  const ids = all.flatMap((ref) => (ref.id ? [ref.id] : []))
  const handles = all.flatMap((ref) => {
    const handle = ref.id === null && ref.path !== null ? handleOfPath(ref.path) : null
    return handle ? [handle] : []
  })
  return { ids: [...new Set(ids)], handles: [...new Set(handles)] }
}

/** A role's page: the page its id names, else the page at its old path; none if neither is one. */
export function rolePage(ref: RoleRef, pages: readonly RolePage[]): RolePage | null {
  if (ref.id !== null) {
    return pages.find((page) => page.id === ref.id) ?? null
  }
  const handle = ref.path === null ? null : handleOfPath(ref.path)
  return handle === null ? null : (pages.find((page) => page.handle === handle) ?? null)
}

/** Every role's page (a deleted one: none). */
export const rolePages = (
  refs: Readonly<Record<PageRole, RoleRef>>,
  pages: readonly RolePage[]
): Record<PageRole, RolePage | null> => ({
  contact: rolePage(refs.contact, pages),
  payment: rolePage(refs.payment, pages),
  shipping: rolePage(refs.shipping, pages),
})

/** A role page's address while it is live (the storefront links to it); none while a draft. */
export const livePath = (page: RolePage | null): string | null =>
  page?.status === "published" ? pagePath(page.handle) : null

/**
 * The roles as `GET /store/storefront` gives them: each page's id, which
 * the storefront knows the page by, and its live address, which it links
 * to (the product page's "more on shipping"); none for a role without a
 * page, or with a page deleted or in draft (its address would be a 404).
 */
export const roleAnswer = (roles: Readonly<Record<PageRole, RolePage | null>>) => ({
  contact_page_id: roles.contact?.id ?? null,
  payment_page_id: roles.payment?.id ?? null,
  shipping_page_id: roles.shipping?.id ?? null,
  contact_form_path: livePath(roles.contact),
  payment_info_path: livePath(roles.payment),
  shipping_info_path: livePath(roles.shipping),
})

/**
 * A role after a save:a page sent names it (the old path goes); an old
 * path sent alone (a client from before the ids) names it by address
 * again; else as stored.
 */
export function roleAfterPatch(role: PageRole, before: Fields, patch: Fields): RoleRef {
  const fields = ROLE_FIELDS[role]
  if (patch[fields.id] !== undefined) {
    return { id: textOrNull(patch[fields.id]), path: null }
  }
  if (patch[fields.path] !== undefined) {
    return { id: null, path: textOrNull(patch[fields.path]) }
  }
  return roleRef(before, role)
}

/** The refs a save leaves, before any old path is found. */
export const rolesAfterPatch = (before: Fields, patch: Fields): Record<PageRole, RoleRef> => ({
  contact: roleAfterPatch("contact", before, patch),
  payment: roleAfterPatch("payment", before, patch),
  shipping: roleAfterPatch("shipping", before, patch),
})

/**
 * The role fields a save of the storefront section writes: each role by
 * its page's id once a page is known, its old path written none; an old
 * path that names no page yet is kept (the page may come). `unknown`: the
 * id fields that send anew an id that is none of the shop's pages (an id
 * sent as it is stored passes: its page deleted, the save goes on).
 */
export function roleSave(
  before: Fields,
  patch: Fields,
  pages: readonly RolePage[]
): { fields: Record<string, string | null>; unknown: string[] } {
  const refs = rolesAfterPatch(before, patch)
  const fields: Record<string, string | null> = {}
  const unknown: string[] = []
  for (const role of PAGE_ROLES) {
    const names = ROLE_FIELDS[role]
    const ref = refs[role]
    if (ref.id !== null) {
      const changed = ref.id !== textOrNull(before[names.id])
      if (changed && !pages.some((page) => page.id === ref.id)) {
        unknown.push(names.id)
      }
      fields[names.id] = ref.id
      fields[names.path] = null
      continue
    }
    const found = rolePage(ref, pages)
    fields[names.id] = found?.id ?? null
    fields[names.path] = found ? null : ref.path
  }
  return { fields, unknown }
}
