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
 * The calendar over the dates (adr/0077 §6, PR6): opened from a day or the
 * month field once the page runs JavaScript, it fills the same fields
 * (`from`, `to`, `month`'s name with up to `maxMonths` months). Its days'
 * lowest prices come from `url` (the storefront's own, never the
 * backend's) only once it is open. Every word in Turkish already.
 */
export interface SearchFormCalendarView {
  /** `GET ?month=YYYY-MM[&kategori=][&kisi=]` answering a `SearchCalendarMonthView`. */
  url: string
  /** A range's most days, both ends included (62). */
  maxDays: number
  /** Flexible months chosen at once at most (3). */
  maxMonths: number
  words: {
    title: string
    exact: string
    flexible: string
    previous: string
    next: string
    close: string
    clear: string
    apply: string
    /** Monday first, short ("Pzt"). */
    weekdays: string[]
    /** "{date}, en düşük {price}, {count} kalkış": a day's button to a screen reader. */
    dayPriced: string
    /** "{date}, {count} kalkış": a departure with no price. */
    dayCounted: string
    /** "{date}, kalkış yok". */
    dayEmpty: string
    pickStart: string
    pickEnd: string
    /** "En çok {count} gün seçilebilir". */
    rangeLimit: string
    /** "En çok {count} ay seçilebilir". */
    monthLimit: string
    loading: string
    failed: string
  }
}

/** One day of the calendar's month: a departure a search would match, and its lowest price. */
export interface SearchCalendarDayView {
  /** `YYYY-MM-DD`. */
  date: string
  departures: number
  /** "12.400,00 TL"; null when no departure has a price. */
  price: string | null
  /** "₺12,4 B": the price under the day on a phone. */
  short: string | null
  /** "₺12.400": the price under the day from 768 px. */
  whole: string | null
}

/** The calendar's answer for one month; days with no departure left out. */
export interface SearchCalendarMonthView {
  month: string
  days: SearchCalendarDayView[]
}

/**
 * The dates: a range of two days or a flexible month (adr/0077 §2). Two
 * plain day fields and a month drop-down; the calendar (PR6) opens over
 * them with JavaScript, the names stay.
 */
export interface SearchFormDatesView {
  /** The group's name ("Tarih"). */
  label: string
  from: SearchFormDayView
  to: SearchFormDayView
  /** "Esnek ay": this month and the next eleven. */
  month: SearchFormSelectView
  /** The calendar; absent: the plain fields only, with JavaScript too. */
  calendar?: SearchFormCalendarView
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
}
