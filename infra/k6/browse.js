// Store API reading under load (F15.3, docs/05): a shopper walking the
// catalogue: the product list, a product, the categories, a path the
// storefront resolves, robots.txt and the sitemap index. Read-only.
//
//   k6 run -e BASE_URL=http://localhost:9000 -e PUBLISHABLE_KEY=pk_... infra/k6/browse.js
//
// Targets (docs/05): Store API reads p95 < 500 ms uncached, < 200 ms cached;
// `/store/seo/resolve` (cached) p95 < 20 ms.
import http from "k6/http"
import { check, group, sleep } from "k6"

const BASE = __ENV.BASE_URL || "http://localhost:9000"
const KEY = __ENV.PUBLISHABLE_KEY || ""
const headers = { "x-publishable-api-key": KEY }

// SCENARIO=spike: a campaign's moment, visits jumping from 5 a second to
// PEAK (100) within ten seconds and staying there, then falling away
const spike = {
  executor: "ramping-arrival-rate",
  startRate: 5,
  timeUnit: "1s",
  preAllocatedVUs: 50,
  maxVUs: Number(__ENV.MAX_VUS || 400),
  stages: [
    { duration: "10s", target: Number(__ENV.PEAK || 100) },
    { duration: __ENV.HOLD || "1m", target: Number(__ENV.PEAK || 100) },
    { duration: "10s", target: 5 },
  ],
}

export const options = {
  scenarios: {
    shoppers:
      __ENV.SCENARIO === "spike"
        ? spike
        : {
            executor: "ramping-vus",
            startVUs: 1,
            stages: [
              { duration: "30s", target: Number(__ENV.VUS || 3) },
              { duration: __ENV.HOLD || "2m", target: Number(__ENV.VUS || 3) },
              { duration: "15s", target: 0 },
            ],
          },
  },
  thresholds: {
    http_req_failed: ["rate<0.005"],
    "http_req_duration{kind:list}": ["p(95)<500"],
    "http_req_duration{kind:detail}": ["p(95)<500"],
    "http_req_duration{kind:resolve}": ["p(95)<20"],
    "http_req_duration{kind:seo}": ["p(95)<500"],
  },
}

export function setup() {
  if (!KEY) {
    throw new Error("PUBLISHABLE_KEY is required (Settings > API in the panel, or the seed's key)")
  }
  const list = http.get(`${BASE}/store/products?limit=50&fields=id,handle`, { headers })
  const products = list.json("products") || []
  if (products.length === 0) {
    throw new Error(`no products to browse (status ${list.status})`)
  }
  return { products: products.map((product) => ({ id: product.id, handle: product.handle })) }
}

export default function (data) {
  const product = data.products[Math.floor(Math.random() * data.products.length)]
  group("catalogue", () => {
    const offset = Math.floor(Math.random() * 3) * 20
    const list = http.get(`${BASE}/store/products?limit=20&offset=${offset}`, {
      headers,
      tags: { kind: "list" },
    })
    check(list, { "list 200": (r) => r.status === 200 })
    const detail = http.get(`${BASE}/store/products/${product.id}`, {
      headers,
      tags: { kind: "detail" },
    })
    check(detail, { "detail 200": (r) => r.status === 200 })
    const categories = http.get(`${BASE}/store/product-categories?limit=50`, {
      headers,
      tags: { kind: "list" },
    })
    check(categories, { "categories 200": (r) => r.status === 200 })
  })
  group("seo", () => {
    const resolve = http.get(
      `${BASE}/store/seo/resolve?path=${encodeURIComponent(`/urun/${product.handle}`)}`,
      { headers, tags: { kind: "resolve" } }
    )
    check(resolve, { "resolve 200": (r) => r.status === 200 })
    if (Math.random() < 0.1) {
      check(http.get(`${BASE}/store/seo/robots`, { headers, tags: { kind: "seo" } }), {
        "robots 200": (r) => r.status === 200,
      })
      check(
        // A shop whose sitemap is not built yet answers 404: not a failure
        http.get(`${BASE}/store/seo/sitemaps/sitemap.xml`, {
          headers,
          tags: { kind: "seo" },
          responseCallback: http.expectedStatuses(200, 404),
        }),
        { "sitemap answers": (r) => r.status === 200 || r.status === 404 }
      )
    }
  })
  // A person reads a page before the next; a spike's visits arrive at its own rate
  if (__ENV.SCENARIO !== "spike") {
    sleep(1 + Math.random() * 2)
  }
}
