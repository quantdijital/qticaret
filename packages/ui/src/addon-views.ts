/**
 * Product add-ons' view models (adr/0052): the fields a product page and
 * a cart line's edit form show, and what a line says of its picks. Prices
 * come in words; the kuruş beside them only feed the product page's
 * running total, which shows and decides nothing (the server prices the line).
 */

export interface AddonChoiceView {
  id: string
  label: string
  /** "+300,00 TL", per unit; null when free. */
  price: string | null
  kurus: number
}

/** One add-on as a form field: a typed text or one choice of a few. */
export interface AddonFieldView {
  id: string
  kind: "text" | "choice"
  label: string
  help: string | null
  /** Only a free add-on can be required. */
  required: boolean
  /** The most units one line may hold with it; null: no limit. */
  maxQuantity: number | null
  /** Made to the buyer's wish: the field says the line is outside the right of withdrawal. */
  nonWithdrawable: boolean
  /** A text's price per unit, "+35,00 TL"; null when free or a choice (each choice has its own). */
  price: string | null
  kurus: number
  /** A text's longest length, and its rules in words ("En çok 50 karakter; …"); null for a choice. */
  maxLength: number | null
  rules: string | null
  choices: AddonChoiceView[]
}

/** A line's add-ons, re-opened from the cart: the fields, as picked, and whether they can be taken off. */
export interface AddonFormView {
  productId: string
  fields: AddonFieldView[]
  /** Add-on id → the text typed or the choice's id. */
  values: Record<string, string>
  /** Picks a required add-on lacks: the form opens by itself (the payment waits for it). */
  missingRequired: boolean
  /** The line carries picks and none is required: "remove the options" is offered. */
  removable: boolean
}

/** One pick under a line: "Ürün üzerine yazı: Ahmet (+35,00 TL)". */
export interface LineAddonView {
  label: string
  /** The text typed or the choice's name; plain text, never HTML. */
  value: string | null
  /** "+35,00 TL" per unit; null when free. */
  amount: string | null
  nonWithdrawable: boolean
}
