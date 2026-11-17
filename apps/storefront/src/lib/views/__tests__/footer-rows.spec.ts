import { describe, expect, it } from "vitest"
import type { StoreMainSections, StoreMenu } from "@qticaret/types"
import type { FooterRowsParts } from "../footer-rows"
import { footerRowsOf, freeRowsOf } from "../footer-rows"
import { footerBarOf } from "../main-sections"

/**
 * The free rows footer's view (adr/0070 §5, §2.3): the backend's rows with
 * the shop's details put into their blocks, read forgivingly.
 */

const t = (key: string, values?: Record<string, string | number>) =>
  values ? `${key}:${JSON.stringify(values)}` : key

const link = (label: string, path: string) => ({
  label,
  kind: "url" as const,
  target: null,
  path,
  children: [],
})

const MENUS: StoreMenu[] = [
  { title: "Ana", location: "main", rank: 0, items: [link("Çakılar", "/kategori/cakilar")] },
  { title: "Yardım", location: "footer", rank: 2, items: [link("SSS", "/sss")] },
  { title: "Boş", location: "footer", rank: 1, items: [] },
  { title: "Kurumsal", location: "footer", rank: 0, items: [link("Hakkımızda", "/hakkimizda")] },
]

const PARTS: FooterRowsParts = {
  t,
  menus: MENUS,
  contact: {
    email: "bilgi@example.com",
    phone: "0532 000 00 00",
    phoneHref: "tel:+905320000000",
    whatsappHref: "https://wa.me/905320000000",
    address: "Denizli",
    hours: [{ days: "Pazartesi – Cuma", hours: "09:00 – 18:00" }],
    mapHref: null,
  },
  social: [{ label: "Instagram", href: "https://www.instagram.com/ornek", network: "instagram" }],
  logo: null,
  name: "Örnek Atölye",
  title: "Örnek Atölye Ltd. Şti.",
  trustBadges: [
    { icon: "truck", title: "Kargo", text: null },
    { icon: "shield", title: "Güvenli", text: null },
    { icon: "refresh", title: "İade", text: null },
  ],
  payments: [{ key: "bank_transfer", label: "Havale / EFT", logo: null }],
  carriers: [{ key: "aras", label: "Aras Kargo", logo: null }],
}

const block = (at: number, fields: Record<string, unknown>) => ({
  id: `blok${String(at)}abcd`,
  at,
  device: "all",
  ...fields,
})

const oneRow = (blocks: unknown[], more: Record<string, unknown> = {}) => [
  { id: "satir00001", layout: "1", columns: [{ blocks }], ...more },
]

const blocksOf = (blocks: unknown[], parts: FooterRowsParts = PARTS) =>
  footerRowsOf(oneRow(blocks), parts)[0]?.columns[0]?.blocks ?? []

describe("the free rows footer's view (adr/0070)", () => {
  it("takes a menu block's footer menu by its order, an empty menu counted, its title else the menu's", () => {
    const blocks = blocksOf([
      block(0, { type: "menu", slot: 1, title: null, collapse_phone: true }),
      block(1, { type: "menu", slot: 3, title: "Destek", collapse_phone: false }),
    ])
    expect(blocks).toEqual([
      {
        id: "blok0abcd",
        at: 0,
        device: "all",
        type: "menu",
        title: "Kurumsal",
        links: [{ label: "Hakkımızda", path: "/hakkimizda" }],
        collapsePhone: true,
      },
      {
        id: "blok1abcd",
        at: 1,
        device: "all",
        type: "menu",
        title: "Destek",
        links: [{ label: "SSS", path: "/sss" }],
        collapsePhone: false,
      },
    ])
  })

  it("leaves out a menu block with no menu at its order, or an empty one", () => {
    expect(
      blocksOf([
        block(0, { type: "menu", slot: 2, title: null, collapse_phone: true }),
        block(1, { type: "menu", slot: 7, title: null, collapse_phone: true }),
      ])
    ).toEqual([])
  })

  it("fills the contact block with the shop's details it keeps, and drops it with none", () => {
    const [contact] = blocksOf([
      block(0, {
        type: "contact",
        title: null,
        address: false,
        phone: true,
        whatsapp: false,
        email: true,
        hours: false,
      }),
    ])
    expect(contact).toMatchObject({
      type: "contact",
      address: null,
      phone: "0532 000 00 00",
      whatsappHref: null,
      email: "bilgi@example.com",
      hours: [],
    })
    const none = { ...PARTS.contact, email: null, phone: null, phoneHref: null, whatsappHref: null }
    expect(
      blocksOf(
        [
          block(0, {
            type: "contact",
            title: null,
            address: false,
            phone: true,
            whatsapp: true,
            email: true,
            hours: false,
          }),
        ],
        { ...PARTS, contact: none }
      )
    ).toEqual([])
  })

  it("fills the brand, newsletter, trust, payments and picture blocks", () => {
    const blocks = blocksOf([
      block(0, { type: "brand", logo: true, about: "  Kısa  ", social: true }),
      block(1, { type: "newsletter", title: null, text: null, description: null, variant: "x" }),
      block(2, { type: "trust", limit: 2, layout: "grid" }),
      block(3, { type: "payments", title: null, carriers: true }),
      block(4, {
        type: "image",
        image: { url: "https://cdn.example.com/a.webp", alt: "Rozet", width: 10, height: 5 },
        width: "huge",
        link: { label: null, kind: "url", target: null, path: "/hakkimizda" },
      }),
    ])
    expect(blocks.map((each) => each.type)).toEqual([
      "brand",
      "newsletter",
      "trust",
      "payments",
      "image",
    ])
    expect(blocks[0]).toMatchObject({ logo: null, about: "Kısa", social: PARTS.social })
    expect(blocks[1]).toMatchObject({
      title: "newsletter.title",
      consent: 'newsletter.text:{"shop":"Örnek Atölye Ltd. Şti."}',
      variant: "standard",
    })
    expect(blocks[2]).toMatchObject({ layout: "list", badges: PARTS.trustBadges.slice(0, 2) })
    expect(blocks[3]).toMatchObject({ payments: PARTS.payments, carriers: PARTS.carriers })
    expect(blocks[4]).toMatchObject({
      width: "medium",
      image: { src: "https://cdn.example.com/a.webp", alt: "Rozet" },
      link: { path: "/hakkimizda" },
    })
  })

  it("reads a row forgivingly: steps off their list the defaults, columns as many as the split", () => {
    const [row] = footerRowsOf(
      [
        {
          id: "satir00001",
          layout: "9-9",
          ground: "neon",
          space: "huge",
          align: "end",
          phone_columns: 3,
          divider: "yes",
          columns: [
            { blocks: [block(0, { type: "unknown" }), block(1, { type: "social", title: "S" })] },
          ],
        },
      ],
      PARTS
    )
    expect(row).toMatchObject({
      layout: "1-1-1",
      ground: "inherit",
      space: "medium",
      align: "start",
      phoneColumns: 1,
      divider: false,
    })
    expect(row?.columns).toHaveLength(3)
    expect(row?.columns[0]?.blocks.map((each) => each.type)).toEqual(["social"])
    expect(row?.columns[1]?.blocks).toEqual([])
    expect(footerRowsOf("rows", PARTS)).toEqual([])
  })

  it("keeps a block's screens, an unknown one all of them", () => {
    const [mobile, odd] = blocksOf([
      { ...block(0, { type: "social", title: null }), device: "mobile" },
      { ...block(1, { type: "social", title: null }), device: "tv" },
    ])
    expect(mobile?.device).toBe("mobile")
    expect(odd?.device).toBe("all")
  })

  it("reads the variant's own settings forgivingly", () => {
    expect(freeRowsOf({ ground: "stage", badge_style: "plain", bottom_badges: false })).toEqual({
      ground: "stage",
      badgeStyle: "plain",
      bottomBadges: false,
    })
    expect(freeRowsOf(null)).toEqual({ ground: "well", badgeStyle: "card", bottomBadges: true })
  })

  it("prints the free rows on the footer bar only with the details to fill them", () => {
    const main = {
      footer_bar: {
        id: "mainfooter",
        type: "footer_bar",
        variant: "free_rows",
        payment_badges: ["visa"],
        rows: oneRow([block(0, { type: "payments", title: null, carriers: false })]),
      },
    } as unknown as StoreMainSections
    const { menus, contact, social, name, title, trustBadges, payments, carriers } = PARTS
    const parts = { menus, contact, social, name, title, trustBadges, payments, carriers }
    const bar = footerBarOf(main, t, null, parts)
    expect(bar.freeRows).toEqual({ ground: "well", badgeStyle: "card", bottomBadges: true })
    // The footer's own ways to pay, by their marks, over the providers'
    expect(bar.rows?.[0]?.columns[0]?.blocks[0]).toMatchObject({
      payments: [{ key: "visa", label: "marks.visa", logo: { src: "/marks/visa.png" } }],
    })
    expect(footerBarOf(main, t)).not.toHaveProperty("rows")
  })
})
