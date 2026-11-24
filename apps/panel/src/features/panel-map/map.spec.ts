import { readFileSync, readdirSync } from "node:fs"
import { join, relative } from "node:path"
import { describe, expect, it } from "vitest"
import { ALL_NAV_ITEMS } from "@/components/layout/navigation"
import type { Capability } from "@/features/auth/api/staff"
import { BULK_MESSAGES_FLAG } from "@/features/bulk-messages/api/types"
import { COLLECTIONS_FLAG } from "@/features/collections/paths"
import { GIFT_CARDS_FLAG } from "@/features/gift-cards/api/gift-cards"
import { PAYMENT_LINKS_FLAG } from "@/features/payment-links/api/types"
import { POPUPS_FLAG } from "@/features/popups/api/types"
import { BOOKING_FLAG } from "@/features/products/api/booking"
import { SEO_PART_ITEMS } from "@/features/seo/parts"
import { SETTINGS_GROUPS } from "@/features/settings/sections"
import { WHOLESALE_FLAG } from "@/features/wholesale/api/types"
import en from "@/locales/en.json"
import tr from "@/locales/tr.json"
import { PANEL_MAP, panelScreen, trailOf } from "./map"

const ROUTES = join(process.cwd(), "src/routes")

/**
 * The panel's screens as the router's files name them: `_auth/settings/
 * shipping/index.tsx` is `/settings/shipping`. A file without a component
 * only sends elsewhere (an old address), so it is no screen; a `$param`
 * segment is no place one can name without a record.
 */
function screenPaths(dir = ROUTES): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const path = join(dir, item.name)
    if (item.isDirectory()) {
      return screenPaths(path)
    }
    const name = item.name.replace(/\.tsx$/, "")
    if (!item.name.endsWith(".tsx") || name.startsWith("-") || name.startsWith("_")) {
      return []
    }
    if (!readFileSync(path, "utf8").includes("component")) {
      return []
    }
    const segments = relative(ROUTES, path)
      .replace(/\.tsx$/, "")
      .split(/[\\/]/)
      .filter((segment) => !segment.startsWith("_") && segment !== "index")
    return segments.some((segment) => segment.startsWith("$")) ? [] : [`/${segments.join("/")}`]
  })
}

// Every capability the panel knows: a new one fails to compile here until it is listed
const CAPABILITIES = {
  settings: true,
  catalog: true,
  marketing: true,
  orders: true,
  money: true,
  stock: true,
  moderation: true,
  accounts: true,
  keys: true,
  security: true,
  maintenance: true,
  team: true,
  staff: true,
  audit: true,
  taxId: true,
  travelerDocuments: true,
  travelerRequests: true,
  privacy: true,
  invoices: true,
  migration: true,
  fraud: true,
  bulkMessages: true,
  paymentLinks: true,
  paymentLinksManage: true,
  legalTexts: true,
  vatRates: true,
  searchSynonyms: true,
  orderExport: true,
  customers: true,
  abandonedCarts: true,
  resendMessages: true,
  looks: true,
  wholesale: true,
} satisfies Record<Capability, true>

const FLAGS = new Set([
  BULK_MESSAGES_FLAG,
  COLLECTIONS_FLAG,
  GIFT_CARDS_FLAG,
  PAYMENT_LINKS_FLAG,
  POPUPS_FLAG,
  BOOKING_FLAG,
  WHOLESALE_FLAG,
])

const textOf = (messages: unknown, key: string): unknown =>
  key
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined,
      messages
    )

const sentences = (text: string) => text.split(/[.!?](?:\s|$)/).filter((part) => part.trim())

describe("the panel's map (adr/0079 §4)", () => {
  it("names each screen once", () => {
    const keys = PANEL_MAP.map((screen) => screen.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it("leads every path to a real screen of the router", () => {
    const paths = new Set(screenPaths())
    expect(paths.has("/settings/shipping")).toBe(true)
    expect(paths.has("/settings/sms")).toBe(false)
    expect(PANEL_MAP.filter((screen) => !paths.has(screen.path)).map((s) => s.key)).toEqual([])
  })

  it("names every label in both languages", () => {
    const missing = PANEL_MAP.flatMap((screen) =>
      [tr, en].filter((messages) => typeof textOf(messages, screen.label) !== "string").length > 0
        ? [screen.label]
        : []
    )
    expect(missing).toEqual([])
  })

  it("gives every screen everyday words and a short help in both languages", () => {
    for (const screen of PANEL_MAP) {
      expect(screen.keywords.tr.length, screen.key).toBeGreaterThan(0)
      expect(screen.keywords.en.length, screen.key).toBeGreaterThan(0)
      for (const word of [...screen.keywords.tr, ...screen.keywords.en]) {
        expect(word.trim(), screen.key).not.toBe("")
      }
      for (const help of [screen.help.tr, screen.help.en]) {
        expect(sentences(help).length, screen.key).toBeGreaterThan(0)
        expect(sentences(help).length, screen.key).toBeLessThanOrEqual(3)
      }
    }
  })

  it("gates only by capabilities and flags the panel knows", () => {
    for (const screen of PANEL_MAP) {
      if (screen.needs) {
        expect(Object.keys(CAPABILITIES), screen.key).toContain(screen.needs)
      }
      if (screen.feature) {
        expect(FLAGS.has(screen.feature), screen.key).toBe(true)
      }
    }
  })

  it("sits every screen under one that exists, without a loop", () => {
    for (const screen of PANEL_MAP) {
      if (screen.parent) {
        expect(() => panelScreen(screen.parent ?? ""), screen.key).not.toThrow()
        expect(
          trailOf(screen).map((above) => above.key),
          screen.key
        ).not.toContain(screen.key)
        expect(trailOf(screen).at(-1)?.key, screen.key).toBe(screen.parent)
      }
    }
  })

  it("holds every menu item, settings section and SEO tab, with their paths and gates", () => {
    for (const item of ALL_NAV_ITEMS) {
      expect(panelScreen(item.key)).toMatchObject({ path: item.to, label: item.label })
    }
    for (const section of SETTINGS_GROUPS.flatMap((group) => group.sections)) {
      const screen = panelScreen(`settings.${section.key}`)
      expect(screen.path, section.key).toBe(section.to)
      expect(screen.needs, section.key).toBe(section.needs)
    }
    for (const part of SEO_PART_ITEMS) {
      const screen = PANEL_MAP.find(
        (each) => each.path === "/settings/seo" && each.search?.["part"] === part.part
      )
      expect(screen?.needs, part.part).toBe(part.needs)
      expect(screen?.label, part.part).toBe(`settings.seo.tabs.${part.label}`)
    }
  })
})
