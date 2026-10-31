// A shopper paying under load (F15.3, docs/05): a cart, a product, the
// address, a carrier, the contracts and age step when the shop asks for
// them, then cash on delivery (or bank transfer) to an order. No outside
// provider is reached, so it runs on staging too. Every order is real:
// run it against a test shop, it takes stock.
//
//   k6 run -e BASE_URL=http://localhost:9000 -e PUBLISHABLE_KEY=pk_... infra/k6/checkout.js
//
// From one machine the shop's per-IP limits and the fraud guard's proof
// of work stop it: the backend runs with LOAD_TEST=on (development, test
// or staging only; the environment check refuses it live).
// Targets (docs/05): completing p95 < 800 ms, failures < 0.5%.
import http from "k6/http"
import { check, fail, sleep } from "k6"
import { Counter } from "k6/metrics"

const BASE = __ENV.BASE_URL || "http://localhost:9000"
const KEY = __ENV.PUBLISHABLE_KEY || ""
const PROVIDER = __ENV.PROVIDER || "pp_cod_cod"
// Guest addresses must take mail (the MX check, adr/0038): on staging a
// domain of ours whose mail is caught; locally the backend runs with
// EMAIL_DOMAIN_CHECK=off and example.com, which no mail ever reaches
const EMAIL_DOMAIN = __ENV.EMAIL_DOMAIN || "example.com"
const PAYMENT = {
  pp_cod_cod: "cash_on_delivery",
  "pp_bank-transfer_bank-transfer": "bank_transfer",
}
const headers = { "content-type": "application/json", "x-publishable-api-key": KEY }

const challenged = new Counter("checkout_challenged")
const refused = new Counter("checkout_refused")

export const options = {
  scenarios: {
    shoppers: {
      executor: "ramping-vus",
      startVUs: 1,
      stages: [
        { duration: "20s", target: Number(__ENV.VUS || 5) },
        { duration: __ENV.HOLD || "1m", target: Number(__ENV.VUS || 5) },
        { duration: "10s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.005"],
    checks: ["rate>0.995"],
    "http_req_duration{step:complete}": ["p(95)<800"],
    "http_req_duration{step:payment}": ["p(95)<800"],
    checkout_challenged: ["count==0"],
  },
}

const call = (method, path, body, step, expected) =>
  http.request(method, `${BASE}${path}`, body === null ? null : JSON.stringify(body), {
    headers,
    tags: { step },
    ...(expected ? { responseCallback: http.expectedStatuses(...expected) } : {}),
  })

export function setup() {
  if (!KEY) {
    throw new Error("PUBLISHABLE_KEY is required (Settings > API in the panel, or the seed's key)")
  }
  const regions = http.get(`${BASE}/store/regions`, { headers }).json("regions") || []
  const region = regions.find((each) => (each.countries || []).some((c) => c.iso_2 === "tr"))
  if (!region) {
    throw new Error("no region for Türkiye")
  }
  const list = http.get(
    `${BASE}/store/products?region_id=${region.id}&limit=50&fields=id,*variants.calculated_price,+variants.inventory_quantity`,
    { headers }
  )
  const variants = (list.json("products") || [])
    .flatMap((product) => product.variants || [])
    // Enough stock for the run's orders; none counted means not tracked
    .filter(
      (variant) =>
        variant.calculated_price &&
        (variant.inventory_quantity === null ||
          variant.inventory_quantity === undefined ||
          variant.inventory_quantity >= Number(__ENV.MIN_STOCK || 50))
    )
    .map((variant) => variant.id)
  if (variants.length === 0) {
    throw new Error(`no priced variant with MIN_STOCK in stock (status ${list.status})`)
  }
  return { region: region.id, variants }
}

const address = {
  first_name: "Yük",
  last_name: "Testi",
  phone: "05320000000",
  address_1: "Atatürk Cad. No: 1",
  postal_code: "34710",
  province: "İstanbul",
  city: "Kadıköy",
  country_code: "tr",
}

export default function (data) {
  const variant = data.variants[Math.floor(Math.random() * data.variants.length)]
  const made = call("POST", "/store/carts", { region_id: data.region }, "cart")
  if (!check(made, { "cart made": (r) => r.status === 200 })) {
    fail(`cart: ${made.status}`)
  }
  const id = made.json("cart.id")
  const added = call(
    "POST",
    `/store/carts/${id}/line-items`,
    { variant_id: variant, quantity: 1 },
    "item"
  )
  if (!check(added, { "item added": (r) => r.status === 200 })) {
    return
  }
  // A new address each time: one address's payments are counted per hour (adr/0044)
  const email = `yuk-${__VU}-${__ITER}-${Date.now()}@${EMAIL_DOMAIN}`
  check(
    call(
      "POST",
      `/store/carts/${id}`,
      { email, shipping_address: address, billing_address: address },
      "address"
    ),
    { "address saved": (r) => r.status === 200 }
  )
  const options = call("GET", `/store/shipping-options?cart_id=${id}`, null, "shipping").json(
    "shipping_options"
  )
  if (!options || options.length === 0) {
    fail("no shipping option for the address")
  }
  check(
    call("POST", `/store/carts/${id}/shipping-methods`, { option_id: options[0].id }, "shipping"),
    { "carrier chosen": (r) => r.status === 200 }
  )

  // The contracts the shop has published, accepted as shown (adr/0041 §2)
  const documents = ["pre_information", "distance_sales"]
    .map((kind) =>
      // 404: a text the shop has not published is not asked for
      call(
        "GET",
        `/store/carts/${id}/legal/${kind}?payment=${PAYMENT[PROVIDER]}`,
        null,
        "legal",
        [200, 404]
      )
    )
    .filter((r) => r.status === 200)
    .map((r) => ({ kind: r.json("document.kind"), version: r.json("document.version") }))
  if (documents.length > 0) {
    check(call("POST", `/store/carts/${id}/legal-consents`, { documents }, "legal"), {
      "contracts accepted": (r) => r.status === 200,
    })
  }
  const age = call("GET", `/store/carts/${id}/age-declaration`, null, "age")
  if (age.status === 200 && age.json("age_check.required")) {
    check(
      call(
        "POST",
        `/store/carts/${id}/age-declaration`,
        { birth_date: "1990-01-01", confirmed: true },
        "age"
      ),
      { "age declared": (r) => r.status === 200 }
    )
  }

  const payment = call(
    "POST",
    `/store/carts/${id}/payment-session`,
    { provider_id: PROVIDER },
    "payment"
  )
  if (payment.status === 428) {
    // The fraud guard asked for proof of work: LOAD_TEST is off, or the limits are too small
    challenged.add(1)
    return
  }
  if (payment.status === 403 || payment.status === 429) {
    refused.add(1)
  }
  if (!check(payment, { "payment started": (r) => r.status === 200 })) {
    return
  }
  const completed = call("POST", `/store/carts/${id}/complete`, null, "complete")
  check(completed, {
    "order placed": (r) => r.status === 200 && r.json("type") === "order",
  })
  // A shopper reads the confirmation before the next order
  sleep(1)
}
