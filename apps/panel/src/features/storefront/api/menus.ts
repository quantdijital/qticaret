import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import type { MenuLinkKind } from "@qticaret/types"
import type { LegalKind } from "@/features/legal/api"
import { sdk } from "@/lib/sdk"

/** The storefront's menus (adr/0049, `/admin/storefront-menus`). */

export const MENU_LOCATIONS = ["main", "top", "footer"] as const
export type MenuLocation = (typeof MENU_LOCATIONS)[number]

/** Link kinds that point at a record by its id. */
export const RECORD_KINDS = [
  "category",
  "product",
  "collection",
  "brand",
  "page",
  "post",
  "landing",
] as const
export type RecordKind = (typeof RECORD_KINDS)[number]

/** The storefront's own pages; their names and addresses are the storefront's. */
export const SYSTEM_PAGES = [
  "home",
  "shop",
  "blog",
  "reviews",
  "cart",
  "account",
  "order_lookup",
] as const
export type SystemPage = (typeof SYSTEM_PAGES)[number]

/** The server's limits (backend lib/storefront/menus.ts). */
export const MENU_LIMITS = {
  links: 30,
  children: 20,
  total: 200,
  title: 60,
  label: 60,
  rank: 100,
} as const

/** A link as the panel reads it: what it points at, what it shows now, and whether it is broken. */
export interface AdminLink {
  id: string
  kind: MenuLinkKind
  /** A record's id, a legal kind or a storefront page's key; null for an address. */
  target: string | null
  url: string | null
  /** The shop's own wording; null: the record's name. */
  label: string | null
  /** The record's current name, or the published legal text's title. */
  name: string | null
  /** The record's live path, or the address. */
  path: string | null
  /** Its record is gone or not live, or its legal text not published: the storefront hides it. */
  broken: boolean
  children: AdminLink[]
}

export interface Menu {
  id: string
  title: string
  location: MenuLocation
  rank: number
  items: AdminLink[]
}

/** What a link points at, without its wording. */
export type LinkTarget =
  | { kind: RecordKind; target: string }
  | { kind: "legal"; target: LegalKind }
  | { kind: "system"; target: SystemPage }
  | { kind: "url"; url: string }

/** A link as the server takes it; an address must carry its own name. */
export type LinkInput =
  | { kind: RecordKind | "legal" | "system"; target: string; label: string | null }
  | { kind: "url"; url: string; label: string }

export interface MenuItemInput {
  link: LinkInput
  children: LinkInput[]
}

export interface MenuInput {
  title: string
  location: MenuLocation
  rank: number
  items: MenuItemInput[]
}

/** A saved link as its target. */
export function targetOf(link: Pick<AdminLink, "kind" | "target" | "url">): LinkTarget {
  return link.kind === "url"
    ? { kind: "url", url: link.url ?? "" }
    : ({ kind: link.kind, target: link.target ?? "" } as LinkTarget)
}

const inputOf = (link: AdminLink): LinkInput => {
  const to = targetOf(link)
  return to.kind === "url"
    ? { kind: "url", url: to.url, label: link.label ?? "" }
    : { ...to, label: link.label }
}

/** A saved menu as the server takes it back: moving a footer column sends it whole. */
export const menuInputOf = (menu: Menu, rank = menu.rank): MenuInput => ({
  title: menu.title,
  location: menu.location,
  rank,
  items: menu.items.map((item) => ({
    link: inputOf(item),
    children: item.children.map(inputOf),
  })),
})

const KEY = ["storefront-menus"] as const

/** Every menu: the header's, the top links, then the footer's columns in their order. */
export const menusQuery = () =>
  queryOptions({
    queryKey: KEY,
    queryFn: async () =>
      (await sdk.client.fetch<{ menus: Menu[] }>("/admin/storefront-menus")).menus,
  })

const pathOf = (id: string) => `/admin/storefront-menus/${encodeURIComponent(id)}`

function useMenusChanged() {
  const client = useQueryClient()
  return {
    // The saved menu at once, so the editor never shows the old one while the list reloads
    put: (menu: Menu) => {
      client.setQueryData<Menu[]>(KEY, (menus) =>
        menus?.map((each) => (each.id === menu.id ? menu : each))
      )
    },
    reload: () => client.invalidateQueries({ queryKey: KEY }),
  }
}

export function useCreateMenu() {
  const changed = useMenusChanged()
  return useMutation({
    mutationFn: async (body: MenuInput) =>
      (
        await sdk.client.fetch<{ menu: Menu }>("/admin/storefront-menus", {
          method: "POST",
          body,
        })
      ).menu,
    onSuccess: changed.reload,
  })
}

export function useSaveMenu() {
  const changed = useMenusChanged()
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: MenuInput }) =>
      (await sdk.client.fetch<{ menu: Menu }>(pathOf(id), { method: "POST", body })).menu,
    onSuccess: (menu) => {
      changed.put(menu)
      void changed.reload()
    },
  })
}

export function useDeleteMenu() {
  const changed = useMenusChanged()
  return useMutation({
    mutationFn: (id: string) => sdk.client.fetch(pathOf(id), { method: "DELETE" }),
    onSuccess: changed.reload,
  })
}

/**
 * The footer's columns in a new order: each whose place changed is sent
 * again whole with its new rank (0, 1, 2…), one after another.
 */
export function useOrderFooter() {
  const changed = useMenusChanged()
  return useMutation({
    mutationFn: async (columns: Menu[]) => {
      for (const [rank, column] of columns.entries()) {
        if (column.rank !== rank) {
          await sdk.client.fetch(pathOf(column.id), {
            method: "POST",
            body: menuInputOf(column, rank),
          })
        }
      }
    },
    onSettled: changed.reload,
  })
}
