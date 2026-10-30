import type { BulkNode } from "./bulk"

/**
 * Reading Shopify's bulk files (F14, adr/0042 §1): every value untrusted,
 * texts cut to the platform's lengths, amounts kept only when they are
 * plain decimals.
 */

/** The record type a node's global id names: "Product", "MediaImage". */
export const typeOf = (node: BulkNode): string | null =>
  /^gid:\/\/shopify\/([A-Za-z]+)\//.exec(node.id ?? "")?.[1] ?? null

export const at = (value: unknown, path: string): unknown =>
  path
    .split(".")
    .reduce<unknown>(
      (current, key) =>
        typeof current === "object" && current !== null
          ? (current as Record<string, unknown>)[key]
          : undefined,
      value
    )

/** A text field, trimmed and cut; null when empty or not a text. */
export const text = (value: unknown, path: string, max = 255): string | null => {
  const found = at(value, path)
  return typeof found === "string" && found.trim() !== "" ? found.trim().slice(0, max) : null
}

export const date = (value: unknown, path: string): Date | null => {
  const found = text(value, path, 64)
  const parsed = found ? new Date(found) : null
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null
}

/** A decimal amount as the shop showed it ("1299.90"), or null. */
export const amount = (value: unknown, path: string): string | null => {
  const found = at(value, path)
  const text =
    typeof found === "number" ? String(found) : typeof found === "string" ? found.trim() : ""
  // A plain decimal only: no exponent, no hex, no third decimal rounded away, not empty
  return /^\d{1,10}(\.\d{1,2})?$/.test(text) ? Number(text).toFixed(2) : null
}

/** Children of each parent, in the file's order. */
export function childrenOf(nodes: readonly BulkNode[]): Map<string, BulkNode[]> {
  const children = new Map<string, BulkNode[]>()
  for (const node of nodes) {
    if (node.__parentId) {
      const own = children.get(node.__parentId)
      if (own) {
        own.push(node)
      } else {
        children.set(node.__parentId, [node])
      }
    }
  }
  return children
}

export const roots = (nodes: readonly BulkNode[], type: string) =>
  nodes.filter((node) => !node.__parentId && typeOf(node) === type)
