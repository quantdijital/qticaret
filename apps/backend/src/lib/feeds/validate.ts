import { parseXmlSafely } from "../security/xml"
import { GOOGLE_NAMESPACE } from "./google"

/**
 * Checks a Google feed against the rules of Google's product data
 * specification it has to meet (KK4): the namespace, each item's required
 * attributes and their allowed values. Returns what is wrong, by item id;
 * an empty list is a feed Google takes.
 */

const AVAILABILITIES = new Set(["in_stock", "out_of_stock", "preorder", "backorder"])
const CONDITIONS = new Set(["new", "refurbished", "used"])
const PRICE = /^\d+\.\d{2} [A-Z]{3}$/
const HTTP = /^https?:\/\/\S+$/
const REQUIRED = [
  "g:id",
  "g:title",
  "g:description",
  "g:link",
  "g:image_link",
  "g:availability",
  "g:price",
]

type Item = Record<string, unknown>

const text = (value: unknown): string =>
  typeof value === "string" ? value : typeof value === "number" ? String(value) : ""

const amountOf = (price: string): number => Number(price.split(" ")[0])

function problemsOf(item: Item): string[] {
  const problems = REQUIRED.filter((name) => text(item[name]).trim() === "").map(
    (name) => `${name} missing`
  )
  const price = text(item["g:price"])
  const sale = text(item["g:sale_price"])
  const images = item["g:additional_image_link"]
  const checks: [boolean, string][] = [
    [text(item["g:title"]).length <= 150, "g:title over 150 characters"],
    [text(item["g:description"]).length <= 5000, "g:description over 5000 characters"],
    [HTTP.test(text(item["g:link"])), "g:link is no web address"],
    [HTTP.test(text(item["g:image_link"])), "g:image_link is no web address"],
    [AVAILABILITIES.has(text(item["g:availability"])), "g:availability not allowed"],
    [
      text(item["g:availability"]) !== "preorder" || "g:availability_date" in item,
      "preorder without g:availability_date",
    ],
    [PRICE.test(price), "g:price not like 15.00 TRY"],
    [
      sale === "" || (PRICE.test(sale) && amountOf(sale) < amountOf(price)),
      "g:sale_price not below g:price",
    ],
    [
      !("g:condition" in item) || CONDITIONS.has(text(item["g:condition"])),
      "g:condition not allowed",
    ],
    [
      text(item["g:brand"]) !== "" || text(item["g:identifier_exists"]) === "no",
      "g:brand missing without identifier_exists no",
    ],
    [!Array.isArray(images) || images.length <= 10, "more than 10 additional images"],
  ]
  return [...problems, ...checks.filter(([ok]) => !ok).map(([, problem]) => problem)]
}

export function googleFeedProblems(xml: string): { id: string; problem: string }[] {
  const document = parseXmlSafely(xml, {
    keepAttributes: true,
    isArray: (name) => name === "item" || name === "g:additional_image_link",
  }) as { rss?: { "@_xmlns:g"?: string; channel?: { item?: Item[] } } }
  const rss = document.rss
  if (rss?.["@_xmlns:g"] !== GOOGLE_NAMESPACE) {
    return [{ id: "", problem: "not an RSS 2.0 feed with Google's namespace" }]
  }
  return (rss.channel?.item ?? []).flatMap((item) =>
    problemsOf(item).map((problem) => ({ id: text(item["g:id"]), problem }))
  )
}
