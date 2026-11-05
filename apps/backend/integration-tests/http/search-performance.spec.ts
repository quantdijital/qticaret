import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import {
  leastSimilarity,
  readQuery,
  rootCandidates,
  searchPlan,
  wordsToAnalyse,
} from "../../src/lib/search"
import { searchFields } from "../../src/lib/search/document"
import { SEARCH_INDEX_MODULE } from "../../src/modules/search-index"
import type SearchIndexModuleService from "../../src/modules/search-index/service"
import type { DocumentInput, ListingPlan } from "../../src/modules/search-index/types"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(600 * 1000)

const PRODUCTS = 10_000
const RUNS = 9
/** adr/0056: a search with its facets over 10,000 products answers within this, locally. */
const BUDGET_MS = 150

// A made-up catalogue, the same each run (no Math.random: a figure must repeat)
function seeded(seed: number) {
  let state = seed
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648
    return state / 2_147_483_648
  }
}

const NOUNS = [
  "Kupa",
  "Bıçak",
  "Tabak",
  "Kase",
  "Çakı",
  "Tava",
  "Tencere",
  "Bardak",
  "Fincan",
  "Tişört",
  "Çanta",
  "Kılıf",
  "Defter",
  "Kalem",
  "Lamba",
  "Sandalye",
  "Masa",
  "Halı",
  "Yastık",
  "Saat",
]
const KINDS = [
  "Seramik",
  "Paslanmaz",
  "Katlanır",
  "Ahşap",
  "Cam",
  "Pamuklu",
  "Deri",
  "Bakır",
  "Döküm",
  "Porselen",
  "Keten",
  "Bambu",
  "Mermer",
  "Çelik",
  "Yün",
]
const COLOURS = ["Kırmızı", "Mavi", "Yeşil", "Siyah", "Beyaz", "Gri", "Sarı", "Turuncu"]
const WORDS = [
  "dayanıklı",
  "şık",
  "günlük",
  "kullanım",
  "için",
  "ideal",
  "el",
  "yapımı",
  "doğal",
  "malzeme",
  "kolay",
  "temizlenir",
  "hafif",
  "sağlam",
  "zarif",
  "tasarım",
  "hediye",
  "mutfak",
  "ev",
  "ofis",
  "seyahat",
  "kamp",
  "bulaşık",
  "makinesinde",
  "yıkanabilir",
  "garanti",
  "yerli",
  "üretim",
  "özel",
  "seri",
  "klasik",
  "modern",
  "renk",
  "boyut",
  "set",
  "parça",
  "uzun",
  "ömürlü",
]

function catalogue(channel: string, priceKey: string): DocumentInput[] {
  const random = seeded(7)
  const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)] as T
  return Array.from({ length: PRODUCTS }, (_, at) => {
    const noun = pick(NOUNS)
    const kind = pick(KINDS)
    const colour = pick(COLOURS)
    const brand = `Marka${String(at % 30)}`
    const category = `Kategori ${String(at % 40)}`
    const text = searchFields({
      title: `${kind} ${noun} ${colour} ${String(at % 97)}`,
      codes: [`SKU-${String(at).padStart(6, "0")}`],
      brand,
      categories: [category],
      subtitle: null,
      attributes: [kind, colour],
      options: [colour, pick(["S", "M", "L", "XL"])],
      variants: [],
      tags: [],
      type: null,
      description: Array.from({ length: 40 }, () => pick(WORDS)).join(" "),
    })
    return {
      product_id: `prod_perf_${String(at).padStart(6, "0")}`,
      published: random() > 0.02,
      title: text.title,
      fields: text.fields,
      vocabulary: text.vocabulary,
      sales_channel_ids: [channel],
      category_ids: [`pcat_perf_${String(at % 40)}`],
      categories: [{ id: `pcat_perf_${String(at % 40)}`, name: category }],
      collection_id: null,
      brand: { id: `brand_perf_${String(at % 30)}`, handle: brand.toLowerCase(), name: brand },
      options: [
        `renk=${colour.toLowerCase()}`,
        `malzeme=${kind.toLowerCase()}`,
        `boyut=${pick(["s", "m", "l", "xl"])}`,
      ],
      prices: { [priceKey]: Math.round(50 + random() * 4950) },
      in_stock: random() > 0.1,
      on_sale: false,
      popularity: Math.floor(random() * 20),
      product_created_at: new Date(Date.UTC(2026, 0, 1) + at * 60_000).toISOString(),
    }
  })
}

const median = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0
const worst = (values: number[]) => Math.max(...values)

/**
 * adr/0056 §Performans: a 10,000-product synthetic index answers a search
 * with its facets through the store route within BUDGET_MS (the median
 * of RUNS, after a warm-up); the figures and the main query's plan are
 * printed for the ADR.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("answers a search with facets over 10,000 products within budget", async () => {
      const container = getContainer()
      const shop = await stockShop(container)
      const store = await createStorefront(container)
      const index = container.resolve<SearchIndexModuleService>(SEARCH_INDEX_MODULE)
      const priceKey = `${shop.regionId}:try`
      const rows = catalogue(store.salesChannelId, priceKey)

      const writing = performance.now()
      for (let at = 0; at < rows.length; at += 500) {
        await index.writeDocuments(rows.slice(at, at + 500))
      }
      const written = performance.now() - writing
      await index.refreshWords()
      await container
        .resolve<{ raw: (sql: string) => Promise<unknown> }>(
          ContainerRegistrationKeys.PG_CONNECTION
        )
        .raw("ANALYZE search_document; ANALYZE search_word")

      const ask = async (params: Record<string, string>, query: Record<string, string> = {}) => {
        const started = performance.now()
        const answer = await settle(
          http.get<{ count: number; product_ids: string[]; facets: { brands: unknown[] } }>(
            `/store/listings/products?${new URLSearchParams({
              region_id: shop.regionId,
              currency_code: "try",
              query: new URLSearchParams(query).toString(),
              ...params,
            }).toString()}`,
            { headers: store.headers }
          )
        )
        expect(answer.status).toBe(200)
        return { ms: performance.now() - started, answer: answer.data }
      }
      const measure = async (params: Record<string, string>, query?: Record<string, string>) => {
        await ask(params, query)
        await ask(params, query)
        const times: number[] = []
        let last = await ask(params, query)
        for (let run = 0; run < RUNS; run += 1) {
          last = await ask(params, query)
          times.push(last.ms)
        }
        return {
          median: Math.round(median(times)),
          worst: Math.round(worst(times)),
          last: last.answer,
        }
      }

      const search = await measure({ type: "search", q: "seramik kupa" })
      const filtered = await measure(
        { type: "search", q: "kupa" },
        { renk: "mavi,kirmizi", fiyat: "100-2000", stok: "var", sirala: "fiyat-artan" }
      )
      const typo = await measure({ type: "search", q: "seramk kupa" })
      const broad = await measure({ type: "search", q: "dayanıklı" })
      const all = await measure({ type: "all", id: "all" })

      // The statement a search runs, planned as the route plans it, and how long each part takes
      const planOf = async (q: string): Promise<ListingPlan> => {
        const read = readQuery(q)
        const facts = new Map(
          (
            await index.analyseWords(
              wordsToAnalyse(read).map((word) => ({
                ...word,
                roots: rootCandidates(word.norm),
                least: leastSimilarity(word.norm),
              }))
            )
          ).map(({ norm, ...own }) => [norm, own])
        )
        const planned = searchPlan(read, facts, false)
        return {
          channels: [store.salesChannelId],
          scope: {},
          text: planned
            ? {
                match: planned.match,
                units: planned.units.map((unit) => unit.ranks),
                phrase: read.phrase,
              }
            : null,
          filters: { brands: null, options: [], in_stock: false },
          price: { key: priceKey, min: null, max: null },
          sort: "relevance",
          page: { offset: 0, limit: 24 },
          related: 48,
        }
      }
      const timed = async <T>(work: () => Promise<T>) => {
        const started = performance.now()
        await work()
        return Math.round((performance.now() - started) * 10) / 10
      }
      const parts = async (q: string) => {
        const plan = await planOf(q)
        await index.listing(plan)
        return {
          analyse: await timed(() => planOf(q)),
          listing: await timed(() => index.listing(plan)),
        }
      }
      const explained = await index.explainListing(await planOf("seramik kupa"))
      const explainedBroad = await index.explainListing(await planOf("dayanıklı"))

      process.stdout.write(
        `search performance: ${JSON.stringify({
          products: PRODUCTS,
          write_ms_per_1000: Math.round((written / PRODUCTS) * 1000),
          http_median_ms: {
            search: [search.median, search.last.count],
            filtered: [filtered.median, filtered.last.count],
            typo: [typo.median, typo.last.count],
            broad: [broad.median, broad.last.count],
            all: [all.median, all.last.count],
          },
          parts: {
            search: await parts("seramik kupa"),
            filtered: await parts("kupa"),
            broad: await parts("dayanıklı"),
          },
        })}\n`
      )
      process.stdout.write(`${explained.join("\n")}\n${explainedBroad.join("\n")}\n`)

      expect(search.last.count).toBeGreaterThan(0)
      expect(typo.last.count).toBeGreaterThan(0)
      expect(all.last.count).toBeGreaterThan(9_000)
      expect(search.median).toBeLessThan(BUDGET_MS)
      expect(filtered.median).toBeLessThan(BUDGET_MS)
      expect(typo.median).toBeLessThan(BUDGET_MS)
    })
  },
})
