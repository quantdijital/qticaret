import { messageText } from "../texts"

/** A pick of a product add-on as an order's messages print it (adr/0052 §9). */
export interface LineAddonPick {
  label: string
  /** The typed text, or the chosen option's name. */
  value: string
  /** Its price per unit written out (`₺35,00`); null for a free pick. */
  amount: string | null
}

/** What an order's message knows of a line's add-ons; a line without any leaves both out. */
export interface MessageLineAddons {
  addons?: LineAddonPick[]
  /** A pick made the line to the buyer's wish: outside the right of withdrawal. */
  nonWithdrawable?: boolean
}

/**
 * The lines printed under an order line: each pick ("Kılıf: Desenli Siyah
 * (+₺300,00)"), then the note a personal product carries. A list without
 * prices (a parcel's contents) prints the picks without theirs too. The
 * layout escapes them: a typed text is the shopper's own words.
 */
export function addonLines(line: MessageLineAddons, priced = true): string[] {
  return [
    ...(line.addons ?? []).map((pick) =>
      priced && pick.amount
        ? messageText("order.addon_paid", { ...pick, amount: pick.amount })
        : messageText("order.addon", { label: pick.label, value: pick.value })
    ),
    ...(line.nonWithdrawable ? [messageText("order.non_withdrawable")] : []),
  ]
}

/** A line as a list without prices writes it, its picks under it. */
export const contentLines = (
  item: { title: string; detail: string | null; quantity: number } & MessageLineAddons
): string[] => [
  `${String(item.quantity)} × ${item.title}${item.detail ? ` (${item.detail})` : ""}`,
  ...addonLines(item, false),
]
