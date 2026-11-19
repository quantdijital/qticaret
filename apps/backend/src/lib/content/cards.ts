/**
 * The product and category cards anywhere in a stored value (a design, a
 * document), read without a schema: each card node's kind and record id
 * as `product:<id>` or `category:<id>`. A save checks only the cards it
 * adds (adr/0073 Ek 2026-11-19 (2) K2, as a content save does): one
 * already saved whose record went since is left out when drawn, it does
 * not lock the editor.
 */

const CARD_KINDS: Readonly<Record<string, "product" | "category">> = {
  productCard: "product",
  categoryCard: "category",
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)

/** Every card key in `value`, however deep (iterative: a stored design is not trusted to be shallow). */
export function cardKeys(value: unknown): Set<string> {
  const keys = new Set<string>()
  const stack: unknown[] = [value]
  while (stack.length > 0) {
    const node = stack.pop()
    if (Array.isArray(node)) {
      stack.push(...(node as unknown[]))
      continue
    }
    if (!isObject(node)) {
      continue
    }
    const kind = typeof node["type"] === "string" ? CARD_KINDS[node["type"]] : undefined
    const attrs = node["attrs"]
    if (kind && isObject(attrs) && typeof attrs["id"] === "string") {
      keys.add(`${kind}:${attrs["id"]}`)
    }
    for (const child of Object.values(node)) {
      if (child !== null && typeof child === "object") {
        stack.push(child)
      }
    }
  }
  return keys
}
