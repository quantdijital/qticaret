import type { Resolution, StoreLayout, StoreMenu } from "@qticaret/types"
import { StoreApiError } from "@/lib/store-api/errors"
import { storeAnswer } from "./fake-store-api"

/**
 * The fixed shop's content pages for the preset lock (adr/0073 §2, S3):
 * a plain page with its cover and the contact page the shop chose for its
 * form (adr/0047), each drawn through `ContentScreen` and the theme. The
 * Store API calls only these pages make are answered here; the rest as
 * the frame's and the home page's (`fake-store-api.ts`).
 */

export const CONTENT_FIXTURE = "fixture-content-pages"

type Entity = Extract<Resolution, { type: "entity" }>
type Query = Record<string, unknown> | undefined

interface FixtureEntry {
  id: string
  kind: "page"
  title: string
  handle: string
  path: string
  html: string
  published_at: string | null
  image_url: string | null
  image_alt: string | null
  image_width: number | null
  image_height: number | null
  image_derivatives: null
  images: []
  author_name: null
  author: null
  reading_minutes: number
  category: null
  tags: []
}

const entry = (
  over: Pick<FixtureEntry, "id" | "title" | "handle" | "html"> & Partial<FixtureEntry>
): FixtureEntry => ({
  kind: "page",
  path: `/${over.handle}`,
  published_at: "2026-10-01T09:00:00.000Z",
  image_url: null,
  image_alt: null,
  image_width: null,
  image_height: null,
  image_derivatives: null,
  images: [],
  author_name: null,
  author: null,
  reading_minutes: 1,
  category: null,
  tags: [],
  ...over,
})

/** A page of the shop's own words with its cover: the reading measure under a graphite stage. */
export const ABOUT_PAGE = entry({
  id: "cnt_fixabout",
  title: "Hakkımızda",
  handle: "hakkimizda",
  html:
    "<p>Örnek Atölye, el işçiliğini günlük kullanımla buluşturan bir bıçak mağazasıdır.</p>" +
    "<p>Her ürünü kullanılmak için seçer, <strong>ağzını ve dengesini</strong> kendimiz deneriz.</p>" +
    "<ul><li>Çakılar</li><li>Mutfak bıçakları</li></ul>",
  image_url: "https://cdn.example.com/media/atolye.jpg",
  image_alt: "Atölyeden bir kare",
  image_width: 1600,
  image_height: 900,
})

/** The page the shop's contact form is on (`contact_form_path`). */
export const CONTACT_PAGE = entry({
  id: "cnt_fixcontact",
  title: "İletişim",
  handle: "iletisim",
  html: "<p>Sipariş, ürün ya da iade için bize yazın; iş günlerinde aynı gün dönüyoruz.</p>",
})

export const CONTENT_ENTRIES: readonly FixtureEntry[] = [ABOUT_PAGE, CONTACT_PAGE]

/** A content page as resolve finds it, with no SEO payload (the trail the theme's own). */
export const contentEntity = (page: FixtureEntry): Entity => ({
  type: "entity",
  path: page.path,
  entity_type: "page",
  entity_id: page.id,
  seo: null,
})

/** The answer to a GET of these pages; any other as the frame's and the home page's. */
export function contentAnswer(
  layout: StoreLayout,
  menus: StoreMenu[],
  path: string,
  query: Query
): unknown {
  if (path === "/store/storefront") {
    const shop = storeAnswer(layout, menus, path, query) as {
      storefront: Record<string, unknown>
    }
    return {
      ...shop,
      storefront: {
        ...shop.storefront,
        contact_form_path: CONTACT_PAGE.path,
        payment_info_path: null,
        shipping_info_path: null,
      },
    }
  }
  const content = /^\/store\/content\/(cnt_\w+)$/.exec(path)
  if (content) {
    const found = CONTENT_ENTRIES.find((each) => each.id === content[1])
    if (!found) throw new StoreApiError(404, "not_found", null)
    return { entry: found }
  }
  return storeAnswer(layout, menus, path, query)
}
