import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { UserEvent } from "@testing-library/user-event"
import { vi } from "vitest"
import type { Mock } from "vitest"
import { FOOTER_BAR_DEFAULTS } from "@qticaret/types"
import type { StorefrontSettings } from "@/features/settings/api/sections"
import type { AdminLayout, LayoutDocument } from "@/features/storefront/api/layout"
import type { ThemeSettings } from "@/features/storefront/api/theme"
import { STOREFRONT_THEME_COLOR } from "@/theme/storefront"
import { ThemeEditorPage } from "./theme-editor-page"

/** What the theme editor's specs share: the shop's design, the server and the editor. */

const ALWAYS = { visible: true, starts_at: null, ends_at: null }
/** A main section always shows (adr/0049 Ek 2026-11-14 §5). */
const MAIN = { visible: true, starts_at: null, ends_at: null } as const

/**
 * The theme's settings as the server opens them in the draft (adr/0063 §3):
 * the theme section's defaults until the shop writes its own.
 */
export const THEME: ThemeSettings = {
  settings_version: 2,
  theme: "atolye",
  colors: { primary: null, accent: null, background: "steel" },
  typography: { heading: "manrope", body: "manrope" },
  radius: "soft",
  product_card: {
    ratio: "1:1",
    show_brand: true,
    show_rating: false,
    variant: "standard",
    hover_image: true,
    delivery_note: true,
    full_button: true,
    sale_badge: true,
    low_stock_badge: true,
    sold_out_badge: true,
    sold_out_row: "price",
    no_reviews: "hide",
    button_style: "outline",
    quick_view: false,
    quick_view_trigger: "hover",
    quick_view_rating: true,
    quick_view_summary: true,
    quick_view_quantity: true,
    text_position: "below",
    rating_badge: false,
    arrow: false,
    duration_row: false,
    per_person: false,
  },
  header: { layout: "left", sticky: true },
  buttons: "pill",
  section_spacing: "normal",
  surface_style: "filled",
  listing_text: { size: "md", align: "start", width: "narrow", collapse: true },
  menu_style: "filled",
  shadow: "float",
  chip_style: "filled",
  media_ground: "well",
  density: "airy",
  motion: "calm",
}

export const DOC: LayoutDocument = {
  // The main sections as the server reads them in (adr/0049 Ek 2026-11-14 §5, §7)
  header: [
    { id: "duyurular", type: "announcement_bar", ...ALWAYS, lines: ["Kargo bedava"] },
    {
      id: "mainheader",
      type: "header_bar",
      ...MAIN,
      variant: "standard",
      sticky: true,
      menu_images: "submenus",
      search_style: "field",
    },
  ],
  home: [
    {
      id: "girisbolumu",
      type: "hero",
      ...ALWAYS,
      variant: "standard",
      eyebrow: null,
      heading: null,
      text: null,
      links: [],
      image: null,
    },
    {
      id: "yeniurunler",
      type: "products",
      variant: "grid",
      ...ALWAYS,
      title: null,
      source: { kind: "newest" },
      limit: 12,
      columns: 3,
      more: { kind: "system", target: "shop", label: null },
    },
    { id: "blogyazilari", type: "posts", ...ALWAYS, title: null, limit: 3 },
  ],
  footer: [
    {
      id: "mainfooter",
      type: "footer_bar",
      ...MAIN,
      variant: "ledger",
      ...FOOTER_BAR_DEFAULTS,
      payment_badges: [],
    },
    {
      id: "ebultenkutusu",
      type: "newsletter",
      ...ALWAYS,
      title: null,
      text: null,
      variant: "standard",
      description: null,
    },
  ],
  product: [
    { id: "mainproduct", type: "product_main", ...MAIN, variant: "standard" },
    {
      id: "benzerurunler",
      type: "related_products",
      variant: "grid",
      ...ALWAYS,
      title: null,
      source: { kind: "same_category" },
      limit: 8,
      columns: 3,
    },
  ],
  category: [
    {
      id: "maincategory",
      type: "category_main",
      ...MAIN,
      variant: "standard",
      by_variant: {},
    },
    {
      id: "kategorisss",
      type: "faq",
      ...ALWAYS,
      placement: "top",
      title: null,
      items: [{ question: "Kargo ne zaman çıkar?", answer: "Aynı gün kargoya veririz." }],
    },
    { id: "kategoriyardim", type: "help", ...ALWAYS, placement: "bottom", title: null, text: null },
  ],
  // No content page has a layout of its own yet (adr/0073)
  pages: [],
  // The theme's shared settings (adr/0049 Ek 2026-11-06), as the server fills them
  settings: {
    trust_badges: [{ icon: "truck", title: "Aynı gün kargo", text: null }],
    color_swatches: [{ label: "Siyah", hex: STOREFRONT_THEME_COLOR }],
    low_stock: { enabled: true, threshold: 3 },
    theme: THEME,
    menus: null,
  },
}

/** The design as `GET /admin/storefront-layout` gives it: saved before, published once. */
export const layoutOf = (more: Partial<AdminLayout> = {}): AdminLayout => ({
  draft: DOC,
  is_default: false,
  has_changes: false,
  revision: 1,
  published_at: "2026-11-01T09:00:00.000Z",
  revisions: [
    { revision: 1, published_at: "2026-11-01T09:00:00.000Z", published_by: null, has_menus: false },
  ],
  ...more,
})

export interface Init {
  method?: string
  body?: unknown
}
export type FetchMock = Mock<(url: string, init?: Init) => Promise<unknown>>
export interface AdminMock {
  productCategory: { list: Mock }
  product: { list: Mock }
  productCollection: { list: Mock }
}

export const PATH = "/admin/storefront-layout"
export const DESIGNS = "/admin/storefront-designs"
/** The draft a restore replaced, kept by the server. */
export const KEPT_DRAFT = { id: "sfd_kept1", kind: "auto", name: null } as const
export const SETTINGS = "/admin/platform-settings/storefront"
export const THEME_SETTINGS = "/admin/platform-settings/theme"
const STOREFRONT: StorefrontSettings = {
  announcements: [],
  trust_badges: [],
  primary_color: null,
  hero: null,
  contact_page_id: null,
  payment_page_id: null,
  shipping_page_id: null,
  contact_form_path: null,
  payment_info_path: null,
  shipping_info_path: null,
  color_swatches: [],
  low_stock_threshold: 3,
}
export interface ServeOptions {
  /** The next draft saves fail with this message. */
  refuse?: () => string | null
  /** The storefront section as stored (its old main colour). */
  storefront?: Partial<StorefrontSettings>
  /** The draft's theme settings (adr/0063 §3), over the defaults. */
  theme?: Partial<ThemeSettings>
}

/** A theme save over the stored one: the groups sent replace theirs, field by field. */
function mergeTheme(stored: ThemeSettings, body: Partial<ThemeSettings>): ThemeSettings {
  return {
    ...stored,
    ...body,
    colors: { ...stored.colors, ...body.colors },
    typography: { ...stored.typography, ...body.typography },
    product_card: { ...stored.product_card, ...body.product_card },
    header: { ...stored.header, ...body.header },
  }
}
export const CATEGORIES = [
  {
    id: "pcat_kitchen",
    name: "Mutfak bıçakları",
    handle: "mutfak-bicaklari",
    parent_category_id: null,
  },
  {
    id: "pcat_chefs",
    name: "Şef bıçakları",
    handle: "sef-bicaklari",
    parent_category_id: "pcat_kitchen",
  },
].map((category) => ({ is_active: true, is_internal: false, ...category }))
/** The shop's live products, newest change first. */
export const PRODUCTS = [
  { id: "prod_chef", title: "Şef bıçağı 20 cm", handle: "sef-bicagi-20-cm", status: "published" },
  { id: "prod_bread", title: "Ekmek bıçağı", handle: "ekmek-bicagi", status: "published" },
]

/**
 * The server: the layout, a save answered with the draft it was sent, a
 * preview link per call (`sfl_1`, `sfl_2`…), publish, discard and restore;
 * the storefront section, saved at once.
 */
export function serve(
  fetchMock: FetchMock,
  admin: AdminMock,
  layout: AdminLayout = layoutOf(),
  options: ServeOptions = {}
) {
  const theme = mergeTheme(THEME, options.theme ?? {})
  let current: AdminLayout = {
    ...layout,
    draft: { ...layout.draft, settings: { ...layout.draft.settings, theme } },
  }
  let previews = 0
  fetchMock.mockImplementation((url: string, init?: Init) => {
    const answer = (next: AdminLayout) => {
      current = next
      return Promise.resolve({ layout: next })
    }
    if (url === PATH && init?.method === "POST") {
      const refused = options.refuse?.()
      if (refused) {
        return Promise.reject(Object.assign(new Error(refused), { status: 400 }))
      }
      const { document } = init.body as { document: LayoutDocument }
      return answer({ ...current, draft: document, is_default: false, has_changes: true })
    }
    if (url === PATH) {
      return Promise.resolve({ layout: current })
    }
    if (url === `${PATH}/preview`) {
      previews++
      const path = `/onizleme/sfl_${String(previews)}`
      return Promise.resolve({ url: path, path, expires_at: "2026-11-03T09:00:00.000Z" })
    }
    if (url === `${PATH}/publish`) {
      // As the server: the menu set going live is cleared from the draft (adr/0063 §3)
      const draft = { ...current.draft, settings: { ...current.draft.settings, menus: null } }
      return answer({ ...current, draft, has_changes: false, revision: current.revision + 1 })
    }
    if (url === `${PATH}/discard`) {
      return answer({ ...current, draft: DOC, has_changes: false })
    }
    if (url === SETTINGS) {
      const values = { ...STOREFRONT, ...options.storefront, ...(init?.body as object | undefined) }
      return Promise.resolve({ section: "storefront", values, version: 1 })
    }
    // The theme section is the design's to fall back to: the editor never writes it (adr/0063 §3)
    if (url === THEME_SETTINGS && init?.method !== "POST") {
      return Promise.resolve({ section: "theme", values: theme, version: 1 })
    }
    if (url.startsWith(`${PATH}/revisions/`)) {
      // The draft it replaces kept first, as an automatic save (adr/0064 Ek 2026-11-17)
      const restored = { ...current, draft: { ...DOC, header: [] }, has_changes: true }
      return answer(restored).then((done) => ({ ...done, auto_saved: KEPT_DRAFT }))
    }
    // A look saved from the editor (its looks menu, a publication)
    if (url === DESIGNS && init?.method === "POST") {
      return Promise.resolve({ design: null })
    }
    return Promise.reject(new Error(`unexpected ${url}`))
  })
  admin.productCategory.list.mockResolvedValue({ product_categories: CATEGORIES })
  admin.product.list.mockResolvedValue({ products: [] })
  admin.productCollection.list.mockResolvedValue({ collections: [] })
}

/** The calls made to one address with a body. */
export const postsTo = (fetchMock: FetchMock, url = PATH) =>
  fetchMock.mock.calls.filter(([to, init]) => to === url && init?.method === "POST")

/** The document the last draft save sent. */
export function lastSaved(fetchMock: FetchMock): LayoutDocument | undefined {
  const body = postsTo(fetchMock).at(-1)?.[1]?.body as { document: LayoutDocument } | undefined
  return body?.document
}

export function renderEditor() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ThemeEditorPage />
    </QueryClientProvider>
  )
}

/** The editor once the design is in. */
export const opened = () => screen.findByRole("navigation", { name: "Sayfanın bölümleri" })

type WithJest = typeof globalThis & { jest?: { advanceTimersByTime: (ms: number) => void } }

/**
 * A clock that moves only when the test moves it, and the user who types on
 * it. On the wall clock the autosave's pause ran out between two keystrokes
 * of a busy run, and a test that waited the pause out went past its 5 s;
 * here a keystroke takes no time and a test jumps the pause (`pass`).
 * Testing Library's waits step a fake clock only when they see Jest's, so
 * they are shown one: `findBy` and `waitFor` then move the clock themselves
 * and end by the number of their tries, not by the machine's speed. A
 * `findBy` inside a `waitFor` would step it from two loops at once: use
 * `getBy` there.
 */
export function holdClock(): UserEvent {
  vi.useFakeTimers()
  ;(globalThis as WithJest).jest = {
    advanceTimersByTime: (ms) => {
      vi.advanceTimersByTime(ms)
    },
  }
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
}

/** The wall clock back, after `holdClock`. */
export function releaseClock() {
  Reflect.deleteProperty(globalThis, "jest")
  vi.useRealTimers()
}

/** Lets `ms` pass on the held clock, with what it sets off (a save, its answer). */
export async function pass(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}
