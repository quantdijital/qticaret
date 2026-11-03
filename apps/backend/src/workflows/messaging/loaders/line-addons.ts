import { lineAddonsOf } from "../../../lib/catalog/addons"
import type { MessageLineAddons } from "../../../lib/messaging/templates"
import { lira } from "./types"

/**
 * An order line's add-on picks as its messages print them (adr/0052 §9),
 * from the record the line keeps (`metadata.qt_addons`, amounts in lira
 * per unit): the add-on's name, the typed text or the chosen option, and
 * its price; nothing for a line without any.
 */
export function messageAddonsOf(metadata: unknown): MessageLineAddons {
  const addons = lineAddonsOf(metadata)
  if (!addons || addons.items.length === 0) {
    return {}
  }
  return {
    addons: addons.items.map((item) => ({
      label: item.label,
      value: (item.kind === "choice" ? item.choice_label : item.value) ?? "",
      amount: item.amount > 0 ? lira(item.amount) : null,
    })),
    nonWithdrawable: addons.non_withdrawable,
  }
}
