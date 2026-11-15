import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type {
  AnySection,
  BannerSection,
  FaqSection,
  HeaderBarSection,
  LayoutGroup,
  LayoutLink,
  MarqueeSection,
  PriceBandsSection,
  ProductsSection,
  TrustBadge,
} from "@/features/storefront/api/layout"
import { newHomeSection } from "@/features/storefront/layout/sections"
import { switchVariant } from "@/features/storefront/layout/variants"
import { SectionPanel } from "../section-panel"
import { previewField } from "./preview-fields"
import type { PreviewContext } from "./preview-fields"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))
vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: vi.fn() }, admin: {} } }))

const badges: TrustBadge[] = [
  { icon: "truck", title: "Aynı gün kargo", text: null },
  { icon: "refresh", title: "Kolay iade", text: "14 gün" },
]

/** The section's panel opened at the field an edit label named; the element focused. */
function focusedAt(
  section: AnySection,
  key: string,
  { group = "home", context = {} }: { group?: LayoutGroup; context?: PreviewContext } = {}
) {
  const field = previewField(section, key, context)
  if (!field) {
    throw new Error(`no field ${key}`)
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <SectionPanel
        section={section}
        group={group}
        problems={{}}
        canDuplicate
        onChange={vi.fn()}
        onPlace={vi.fn()}
        onBack={vi.fn()}
        onDuplicate={vi.fn()}
        onRemove={vi.fn()}
        badges={badges}
        onBadges={vi.fn()}
        focus={{ ...field, nonce: 1 }}
      />
    </QueryClientProvider>
  )
  const element = document.getElementById(field.target)
  expect(element).not.toBeNull()
  expect(element?.hasAttribute("data-highlight")).toBe(true)
  expect(element?.contains(document.activeElement)).toBe(true)
  return document.activeElement
}

const link: LayoutLink = { kind: "url", url: "https://a.example", label: "Kampanya" }

/** adr/0065 Faz 2b: a list row's key lands on that row's field in the form, by its saved place. */
describe("a list row named by the preview", () => {
  it("lands on the FAQ's second answer", () => {
    const faq: FaqSection = {
      ...(newHomeSection("faq", "sss0000001") as FaqSection),
      items: [
        { question: "Kargo?", answer: "Aynı gün." },
        { question: "İade?", answer: "14 gün." },
      ],
    }
    expect(focusedAt(faq, "items.1.answer")).toHaveValue("14 gün.")
  })

  it("lands on a strip item's second line", () => {
    const strip: MarqueeSection = {
      ...(newHomeSection("marquee", "kayan00002") as MarqueeSection),
      items: [
        { icon: null, text: "Bir", subtext: null, link: null },
        { icon: null, text: "İki", subtext: "500 TL üstü", link: null },
      ],
    }
    expect(focusedAt(strip, "items.1.subtext")).toHaveValue("500 TL üstü")
  })

  it("lands on a band slide's second button", () => {
    const band: BannerSection = {
      ...(newHomeSection("banner", "bant000001") as BannerSection),
      slides: [
        {
          image: { url: "/a.webp", alt: null },
          mobile_image: null,
          heading: "Kış",
          text: null,
          link: null,
          second_link: link,
          tone: "light",
        },
      ],
    }
    expect(focusedAt(band, "slides.0.second_link")).toHaveValue("Kampanya")
  })

  it("lands on a trust badge's line in the strip's form", () => {
    const strip = newHomeSection("trust_badges", "guven00001")
    expect(focusedAt(strip, "badges.1.text", { context: { badges: 2 } })).toHaveValue("14 gün")
  })

  it("lands on a price band's label", () => {
    const bands = newHomeSection("price_bands", "fiyat00001") as PriceBandsSection
    const [, second] = bands.bands
    expect(focusedAt(bands, "bands.1.label")).toHaveValue(second?.label ?? "")
  })

  it("lands on a columns rail's more list's title", () => {
    const columns: ProductsSection = {
      ...(newHomeSection("products", "sutun00001") as ProductsSection),
      variant: "columns",
      lists: [{ title: "Yeni gelenler", source: { kind: "newest" } }],
    }
    expect(focusedAt(columns, "lists.0.title")).toHaveValue("Yeni gelenler")
  })

  it("lands on a rail's and the categories' see-all link words", () => {
    const rail: ProductsSection = {
      ...(newHomeSection("products", "rafim00001") as ProductsSection),
      more: link,
    }
    expect(focusedAt(rail, "more")).toHaveValue("Kampanya")
    const categories = { ...newHomeSection("categories", "kateg00001"), more: link } as AnySection
    expect(focusedAt(categories, "more")).toHaveValue("Kampanya")
  })

  it("lands on the rich text's edit button and the newsletter's line", () => {
    const story = newHomeSection("rich_text", "metin00001")
    expect(focusedAt(story, "body")?.tagName).toBe("BUTTON")
    const news = { ...newHomeSection("newsletter", "bulten0001"), text: "İzin metni" }
    expect(focusedAt(news, "text")).toHaveValue("İzin metni")
  })

  it("lands on the catalog header's search words", () => {
    const header = {
      ...(switchVariant(
        {
          id: "mainheader",
          type: "header_bar",
          visible: true,
          starts_at: null,
          ends_at: null,
          variant: "standard",
          sticky: true,
          menu_images: "submenus",
        },
        "catalog"
      ) as HeaderBarSection),
      search_placeholder: "Bıçak ara",
    } as HeaderBarSection
    expect(focusedAt(header, "search_placeholder", { group: "header" })).toHaveValue("Bıçak ara")
  })
})
