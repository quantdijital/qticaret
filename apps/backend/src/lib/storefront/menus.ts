import { z } from "@medusajs/framework/zod"
import { LEGAL_KINDS } from "../legal"
import { isHttpsUrl } from "../security/https-url"
import { isCleanText } from "../security/text"

/**
 * A storefront menu as the panel writes it (adr/0049): a title, where it
 * shows, and its links, each pointing at a record, a legal text, one of
 * the storefront's own pages, or an address. Only the header's menu has
 * children (one level).
 */

/** The storefront's own pages a menu links to by name; their addresses are the storefront's. */
export const SYSTEM_LINKS = [
  "home",
  "shop",
  "blog",
  "reviews",
  "cart",
  "account",
  "order_lookup",
] as const
export type SystemLink = (typeof SYSTEM_LINKS)[number]

/** Link kinds that point at a record by its id. */
export const RECORD_LINK_KINDS = [
  "category",
  "product",
  "collection",
  "brand",
  "page",
  "post",
  "landing",
] as const
export type RecordLinkKind = (typeof RECORD_LINK_KINDS)[number]

export const MENU_LIMITS = { links: 30, children: 20, total: 200, title: 60, label: 60 } as const

const MAX_PATH_LENGTH = 512

/** A path on the shop: one leading slash, no `//`, no backslash or whitespace. */
export const isShopPath = (value: string): boolean =>
  value.length <= MAX_PATH_LENGTH &&
  value.startsWith("/") &&
  !value.startsWith("//") &&
  !value.includes("\\") &&
  !/\s/.test(value)

const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => isCleanText(value), { message: "storefront_menus.text_invalid" })

const label = text(MENU_LIMITS.label).nullable().default(null)

const recordId = z
  .string()
  .regex(/^[a-z]+_[0-9A-Za-z]{1,40}$/, { message: "storefront_menus.target_invalid" })

const link = z.discriminatedUnion("kind", [
  z.object({ kind: z.enum(RECORD_LINK_KINDS), target: recordId, label }).strict(),
  z.object({ kind: z.literal("legal"), target: z.enum(LEGAL_KINDS), label }).strict(),
  z.object({ kind: z.literal("system"), target: z.enum(SYSTEM_LINKS), label }).strict(),
  z
    .object({
      kind: z.literal("url"),
      url: z
        .string()
        .trim()
        .refine((value) => isCleanText(value) && (isShopPath(value) || isHttpsUrl(value)), {
          message: "storefront_menus.url_invalid",
        }),
      // An address has no name of its own
      label: text(MENU_LIMITS.label),
    })
    .strict(),
])

export type MenuLinkInput = z.infer<typeof link>

/** A link to a record, a legal text, a storefront page or an address: menus, buttons and banners (adr/0049). */
export const storefrontLink = link

const withChildren = z.object({
  link,
  children: z.array(link).max(MENU_LIMITS.children).default([]),
})

/** A menu's links as the panel sends them: each link with its children beside it. */
export const menuInput = z
  .object({
    title: text(MENU_LIMITS.title),
    location: z.enum(["main", "top", "footer"]),
    rank: z.number().int().min(0).max(100).default(0),
    items: z.array(withChildren).max(MENU_LIMITS.links),
  })
  .strict()
  .superRefine((menu, ctx) => {
    const total = menu.items.reduce((sum, each) => sum + 1 + each.children.length, 0)
    if (total > MENU_LIMITS.total) {
      ctx.addIssue({ code: "custom", message: "storefront_menus.too_many", path: ["items"] })
    }
    // Only the header's menu opens a panel of children
    if (menu.location !== "main" && menu.items.some((each) => each.children.length > 0)) {
      ctx.addIssue({ code: "custom", message: "storefront_menus.no_children", path: ["items"] })
    }
  })

export type MenuInput = z.infer<typeof menuInput>
export type MenuItemInput = MenuInput["items"][number]
