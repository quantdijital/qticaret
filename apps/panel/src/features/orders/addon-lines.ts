/**
 * A line's add-ons (adr/0052 §1): the server keeps a copy of what was
 * picked, as it was priced, in `metadata.qt_addons`, so the order still
 * says what it sold once the product's add-ons change. Amounts are per
 * unit in lira. A customer's erasure request turns a typed text into "—";
 * the add-on's name and price stay.
 */

export interface LineAddon {
  id: string
  kind: "text" | "choice"
  label: string
  /** What the shopper typed, or the option's name. */
  value: string | null
  amount: number
}

export interface LineAddons {
  items: LineAddon[]
  /** Made to the buyer's wish: the line is outside the right of withdrawal. */
  nonWithdrawable: boolean
}

type Row = Record<string, unknown>

const isRow = (value: unknown): value is Row =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const text = (value: unknown): string | null =>
  typeof value === "string" && value !== "" ? value : null

function itemOf(item: unknown, index: number): LineAddon[] {
  if (!isRow(item)) {
    return []
  }
  const label = text(item["label"])
  if (!label) {
    return []
  }
  const kind = item["kind"] === "choice" ? "choice" : "text"
  return [
    {
      id: text(item["addon_id"]) ?? String(index),
      kind,
      label,
      value: kind === "choice" ? text(item["choice_label"]) : text(item["value"]),
      amount: typeof item["amount"] === "number" ? item["amount"] : 0,
    },
  ]
}

/** What a line's metadata says of its add-ons; null for a line without any. */
export function lineAddonsOf(metadata: unknown): LineAddons | null {
  const addons = isRow(metadata) ? metadata["qt_addons"] : undefined
  if (!isRow(addons) || !Array.isArray(addons["items"])) {
    return null
  }
  const raw: unknown[] = addons["items"]
  const items = raw.flatMap(itemOf)
  if (items.length === 0) {
    return null
  }
  return {
    items,
    nonWithdrawable:
      addons["non_withdrawable"] === true ||
      raw.some((item) => isRow(item) && item["non_withdrawable"] === true),
  }
}
