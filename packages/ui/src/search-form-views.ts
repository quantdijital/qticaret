/**
 * The shop's one search box as a theme draws it (adr/0077 §1): in a
 * `search_box` section, on top of `/arama` (its values filled), later in a
 * full-picture hero. A plain GET form to `action` that works without
 * JavaScript: every field carries its own `name`, so a theme never spells
 * an address parameter. Which fields there are is the shop's theme setting
 * (`search_form`) and its feature flags: the dates and the party only
 * while it sells dated products. Every word is already in Turkish; a field
 * that is null is not drawn. A theme without it draws no box.
 */

/** One choice of a drop-down or a tab. */
export interface SearchFormOptionView {
  value: string
  label: string
}

/** A drop-down: its choices after the empty one (`anyLabel`, value ""). */
export interface SearchFormSelectView {
  name: string
  label: string
  /** The empty choice's words ("Tümü", "Fark etmez"); null: no empty choice (the party). */
  anyLabel: string | null
  options: SearchFormOptionView[]
  /** The chosen value; "" none. */
  value: string
}

/** A day field (`<input type="date">`), its bounds as `YYYY-MM-DD`. */
export interface SearchFormDayView {
  name: string
  label: string
  /** `YYYY-MM-DD`; "" none. */
  value: string
  min: string
  max: string
}

/**
 * The dates: a range of two days or a flexible month (adr/0077 §2). Two
 * plain day fields and a month drop-down; a later calendar (PR6) may
 * replace them on screen, the names stay.
 */
export interface SearchFormDatesView {
  /** The group's name ("Tarih"). */
  label: string
  from: SearchFormDayView
  to: SearchFormDayView
  /** "Esnek ay": this month and the next eleven. */
  month: SearchFormSelectView
}

export interface SearchFormView {
  /** Where it goes (`/arama`). */
  action: string
  /** The form's name for a screen reader ("Ürün ara"). */
  label: string
  /** The button's words ("Ara"). */
  submit: string
  /** Values carried as they are (a search's words when no words field is drawn). */
  hidden: { name: string; value: string }[]
  /** A words field (`q`): drawn when the shop names no "where" attribute; null: none. */
  words: { name: string; label: string; placeholder: string; value: string } | null
  /**
   * The categories, as a drop-down (`select`) or as tabs over the bar
   * (`tabs`: radios, the empty choice first); null: none.
   */
  category: (SearchFormSelectView & { style: "select" | "tabs" }) | null
  /** The shop's "where" attribute's values (a travel shop's "Gidilecek yer"); null: none. */
  where: SearchFormSelectView | null
  /** Dated products only; null: none. */
  dates: SearchFormDatesView | null
  /** Places the party takes, 1 to 20 (no empty choice); dated products only; null: none. */
  people: SearchFormSelectView | null
}

/** The search box section (`search_box`): its words over the box; its ground the look's. */
export interface SearchBoxSectionView {
  id: string
  type: "search_box"
  /** The shop's heading (an h2); null: none, the form named by its own label. */
  title: string | null
  intro: string | null
  form: SearchFormView
  /**
   * Words under the box while the shop reads sentences (adr/0077 §7): a
   * sentence may be written, personal details may not; none: nothing.
   */
  hint?: string | null
}
