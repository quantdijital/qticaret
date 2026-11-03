/**
 * Product add-ons (adr/0052): what a shopper picks beside the variant, a
 * typed text or one of a few choices, each priced per unit on the server.
 * Prices are lira, KDV in, as Medusa keeps amounts.
 */

/** Which characters a typed text may hold: letters, digits, spaces; `text` adds `. , ' - &`. */
export type StoreAddonCharset = "letters_digits" | "text"

export interface StoreAddonChoice {
  id: string
  label: string
  price: number
}

/** `GET /store/products/:id/addons`: one of a product's add-ons (404 while the shop has none on). */
export type StoreProductAddon = {
  id: string
  label: string
  help: string | null
  /** Only a free add-on can be required. */
  required: boolean
  /** The most units one line may hold with it; null: no limit. */
  max_quantity: number | null
  /** Made to the buyer's wish: the line is outside the right of withdrawal. */
  non_withdrawable: boolean
} & (
  | {
      kind: "text"
      price: number
      text: { max_length: number; charset: StoreAddonCharset }
    }
  | { kind: "choice"; choices: StoreAddonChoice[] }
)

/** What `POST /store/carts/:id/line-items/:line_id/addons` takes for one add-on: no price, ever. */
export interface StoreAddonSelection {
  addon_id: string
  value?: string
  choice_id?: string
}

/** One chosen add-on as a cart or order line records it (`metadata.qt_addons.items`). */
export interface StoreLineAddon {
  addon_id: string
  kind: "text" | "choice"
  label: string
  /** The typed text; "—" once erased (KVKK). */
  value?: string
  choice_id?: string
  choice_label?: string
  /** Per unit. */
  amount: number
  non_withdrawable: boolean
}

/** A line's `metadata.qt_addons`, written by the server alone. */
export interface StoreLineAddons {
  items: StoreLineAddon[]
  /** The variant's unit price the add-ons were added to. */
  base: number
  non_withdrawable: boolean
  max_quantity: number | null
}
