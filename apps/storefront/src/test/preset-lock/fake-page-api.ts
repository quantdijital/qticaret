import type { StoreLayout, StoreMenu } from "@qticaret/types"
import { storeAnswer } from "./fake-store-api"
import { PAGE_CATEGORY, PAGE_LISTING, PAGE_PRODUCT, pagePriceDisplay } from "./fixture-pages"

/**
 * The fixed shop's Store API for the product and category pages (preset
 * lock): what `fake-store-api.ts` answers for the frame and the home page,
 * and the calls only these pages make, from `fixture-pages.ts`. A call
 * nobody answered throws, naming it.
 */

type Query = Record<string, unknown> | undefined

const list = (value: unknown): string[] =>
  value === undefined ? [] : (Array.isArray(value) ? value : [value]).map(String)

const PRODUCT_PATH = `/store/products/${PAGE_PRODUCT.id}`

/** Its reviews: three approved, one with the shop's reply. */
const REVIEWS = {
  rating: { average: 4.7, count: 3, distribution: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 2 } },
  reviews: [5, 4, 5].map((rating, index) => ({
    id: `rev_page_${String(index)}`,
    rating,
    title: index === 0 ? "Elde çok iyi duruyor" : null,
    body: "Kılıfı sağlam, ağzı kutudan keskin çıktı.",
    author_name: ["Ayşe K.", "Mehmet T.", "Zeynep A."][index] ?? null,
    created_at: `2026-10-${String(20 + index)}T12:00:00.000Z`,
    verified_purchase: index !== 1,
    photos: [],
    reply:
      index === 0
        ? {
            body: "Teşekkür ederiz.",
            author_name: "Örnek Atölye",
            created_at: "2026-10-21T09:00:00.000Z",
          }
        : null,
  })),
  count: 3,
}

const QUESTIONS = {
  questions: [
    {
      body: "Kılıfı deri mi?",
      author_name: "Can Ö.",
      created_at: "2026-10-18T10:00:00.000Z",
      answers: [{ body: "Evet, bitkisel tabaklanmış deri.", author_name: null, by_shop: true }],
    },
  ],
  count: 1,
}

/**
 * The category's own text as the shop formatted it (adr/0075): a heading,
 * paragraphs and a list, long enough to open folded at the page's foot.
 */
const CATEGORY_TEXT = {
  category_id: PAGE_CATEGORY,
  description_html: [
    "<h2>El yapımı çakı seçerken</h2>",
    "<p>Her çakı atölyede tek tek dövülür, ısıl işlemden geçer ve elde bilenir. Çeliğin cinsi, sapın malzemesi ve kilit düzeni günlük kullanımda nasıl bir yol arkadaşı olacağını belirler.</p>",
    "<h3>Çelik</h3>",
    "<p><strong>N690</strong> paslanmaya dayanıklıdır ve kolay bilenir; Damascus desenli çelik hem dayanıklı hem göz alıcıdır; Elmax ağzını uzun süre korur.</p>",
    "<ul><li>Ceviz, kemik ya da geyik boynuzu sap</li><li>Bitkisel tabaklanmış deri kılıf</li><li>Ömür boyu bileme hizmeti</li></ul>",
    '<p>Bakım önerilerimiz için <a href="/sayfa/bakim">bakım rehberine</a> göz atın.</p>',
  ].join(""),
}

/** The shop's installments for any price: two card families up to six. */
function installments(query: Query) {
  const variant = list(query?.["variant_id"])[0] ?? ""
  const price = Number(pagePriceDisplay([variant])[variant]?.current ?? 1000)
  const option = (count: number, rate: number) => {
    const total = price * (1 + rate / 100)
    return { count, rate, total: total.toFixed(2), per_installment: (total / count).toFixed(2) }
  }
  return {
    installments: {
      enabled: true,
      max_count: 6,
      families: ["bonus", "world"].map((family) => ({
        family,
        options: [option(1, 0), option(3, 0), option(6, 4.5)],
      })),
    },
  }
}

export function pageAnswer(
  layout: StoreLayout,
  menus: StoreMenu[],
  path: string,
  query: Query
): unknown {
  switch (path) {
    case PRODUCT_PATH:
      return { product: PAGE_PRODUCT }
    case `${PRODUCT_PATH}/description`:
      return {
        html: "<p>Elde dövülmüş <strong>N690</strong> çelik.</p><ul><li>Ceviz sap</li><li>Deri kılıf</li></ul>",
        summary_html: "<p>Günlük av ve kamp için dengeli bir bıçak.</p>",
        images: [],
      }
    case `${PRODUCT_PATH}/reviews`:
      return REVIEWS
    case `${PRODUCT_PATH}/questions`:
      return QUESTIONS
    case "/store/payment/installments":
      return installments(query)
    case "/store/listings/products":
      return PAGE_LISTING
    case `/store/category-descriptions/${PAGE_CATEGORY}`:
      return CATEGORY_TEXT
    case "/store/price-display": {
      const shop = storeAnswer(layout, menus, path, query) as {
        price_display: Record<string, unknown>
      }
      return {
        price_display: { ...shop.price_display, ...pagePriceDisplay(list(query?.["variant_id"])) },
      }
    }
  }
  return storeAnswer(layout, menus, path, query)
}
