import type { ReactNode, Ref } from "react"
import { Search } from "lucide-react"
import { ResponsiveImage } from "@qticaret/ui"
import type { LinkView, SuggestProductView, SuggestState } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

/** The panel's words, already the shop's language; `{q}`, `{count}`, `{price}` filled here. */
export interface SearchPanelWords {
  /** The list's name for a screen reader: "Arama önerileri". */
  results: string
  products: string
  categories: string
  brands: string
  /** "Bunu mu demek istediniz?" */
  phrases: string
  /** "Tüm sonuçları gör ({count})". */
  all: string
  /** "“{q}” için sonuç bulunamadı". */
  none: string
  /** Over the shop's categories when nothing was found. */
  browse: string
  loading: string
  error: string
  /** "{count} öneri var…", said once the options are in. */
  found: string
  /** "Önceki fiyat:", before the struck price for a screen reader. */
  priceBefore: string
  /** "{price}'den başlayan". */
  from: string
}

/** What the panel shows for a state; null: no panel (fewer than two characters). */
export interface PanelModel {
  kind: "loading" | "results" | "empty" | "error"
  q: string
  /** An answer is on its way; the last one stays, dimmed. */
  busy: boolean
  /** Nothing found for the words (said above whatever help there is). */
  none: boolean
  products: SuggestProductView[]
  phrases: LinkView[]
  categories: LinkView[]
  brands: LinkView[]
  /** The shop's categories, offered when nothing at all was found. */
  browse: LinkView[]
  all: { path: string; total: number } | null
  /** Every option's path in the panel's order: the arrow keys' list. */
  paths: string[]
}

const NOTHING = { products: [], phrases: [], categories: [], brands: [], browse: [], all: null }

/** The panel for a live search state; the shop's categories stand by for an empty answer. */
export function panelOf(state: SuggestState, browse: readonly LinkView[]): PanelModel | null {
  if (state.status === "idle") {
    return null
  }
  const view = state.status === "error" ? null : state.view
  const busy = state.status === "loading"
  const help = view ? view.suggestions.length + view.categories.length + view.brands.length : 0
  // Nothing to show yet (or only an empty answer for other words): the loading rows
  if (state.status === "error" || !view || (busy && view.products.length + help === 0)) {
    return {
      kind: state.status === "error" ? "error" : "loading",
      q: state.q,
      busy,
      none: false,
      ...NOTHING,
      paths: [],
    }
  }
  const empty = view.products.length + help === 0
  const groups = {
    products: view.products,
    phrases: view.suggestions,
    categories: view.categories,
    brands: view.brands,
    browse: empty ? [...browse] : [],
    all: view.total > 0 ? { path: view.allPath, total: view.total } : null,
  }
  return {
    kind: empty ? "empty" : "results",
    q: view.q,
    busy,
    none: view.total === 0,
    ...groups,
    paths: [
      ...groups.products.map((product) => product.path),
      ...[...groups.phrases, ...groups.categories, ...groups.brands, ...groups.browse].map(
        (link) => link.path
      ),
      ...(groups.all ? [groups.all.path] : []),
    ],
  }
}

/** What the status line says to a screen reader for the panel now. */
export function statusOf(model: PanelModel | null, words: SearchPanelWords): string {
  switch (model?.kind) {
    case undefined:
      return ""
    case "loading":
      return words.loading
    case "error":
      return words.error
    case "empty":
      return words.none.replace("{q}", model.q)
    case "results":
      return model.busy ? words.loading : words.found.replace("{count}", String(model.paths.length))
  }
}

const OPTION = "gf-option"

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1">
      <p aria-hidden="true" className="px-2 pt-1 text-xs font-semibold text-text-3">
        {label}
      </p>
      {children}
    </div>
  )
}

/**
 * The live search's panel under the field (a listbox the field controls,
 * its options links): the hits with photo, name and the card's price, the
 * struck price before it when the 30-day rule allows one; beside them on
 * wide screens (under them on a phone) "did you mean", the categories and
 * brands; the shop's categories when nothing was found; "Tüm sonuçları
 * gör (n)" last. Loading shows rows of the hits' height, or keeps the last
 * answer dimmed; a failure is one quiet line. The field keeps the focus;
 * `active` is the option the arrow keys are on.
 */
export function SearchPanel({
  model,
  words,
  listboxId,
  optionId,
  active,
  hidden,
  panelRef,
}: {
  model: PanelModel | null
  words: SearchPanelWords
  listboxId: string
  optionId: (index: number) => string
  active: number
  hidden: boolean
  panelRef?: Ref<HTMLDivElement>
}) {
  let index = 0
  const option = (path: string) => {
    const at = index++
    return { id: optionId(at), href: path, "aria-selected": at === active, tabIndex: -1 }
  }
  const chips = (label: string, links: readonly LinkView[], phrase = false) =>
    links.length > 0 && (
      <Group label={label}>
        <div role="none" className="flex flex-wrap gap-1.5 px-1">
          {links.map((link) => (
            <a
              key={link.path}
              role="option"
              {...option(link.path)}
              className="gf-chip gf-option-chip"
            >
              {phrase && <Search className="size-4" aria-hidden="true" strokeWidth={2} />}
              {link.label}
            </a>
          ))}
        </div>
      </Group>
    )
  const side = model ? model.phrases.length + model.categories.length + model.brands.length : 0
  return (
    <div ref={panelRef} hidden={hidden} className="gf-suggest">
      {model?.kind === "loading" && (
        <div aria-hidden="true" className="flex flex-col gap-1 p-2 lg:p-3">
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex min-h-16 items-center gap-3 px-2">
              <span className="size-12 shrink-0 rounded-inner bg-paper-2 motion-safe:animate-pulse" />
              <span className="h-3.5 w-1/2 rounded-pill bg-paper-2 motion-safe:animate-pulse" />
            </div>
          ))}
        </div>
      )}
      {model?.kind === "error" && <p className="px-5 py-4 text-sm text-text-2">{words.error}</p>}
      {model?.none === true && (
        <p className="px-5 pt-4 pb-1 text-sm font-semibold break-words">
          {words.none.replace("{q}", model.q)}
        </p>
      )}
      <div
        role="listbox"
        id={listboxId}
        aria-label={words.results}
        aria-busy={model?.busy === true}
        hidden={!model || model.paths.length === 0}
        className={cn(
          "grid gap-x-4 gap-y-3 p-2 transition-opacity duration-(--dur-micro) lg:p-3",
          model && model.products.length > 0 && side > 0 && "lg:grid-cols-[minmax(0,1fr)_13rem]",
          model?.busy && "opacity-60"
        )}
      >
        {model && model.products.length > 0 && (
          <Group label={words.products}>
            {model.products.map((product) => (
              <a key={product.id} role="option" {...option(product.path)} className={OPTION}>
                <span className="size-12 shrink-0 overflow-hidden rounded-inner bg-media">
                  {product.image && (
                    <ResponsiveImage
                      image={{ ...product.image, alt: "" }}
                      sizes="48px"
                      className="size-full object-cover"
                    />
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="line-clamp-2 text-sm leading-snug font-semibold">
                    {product.title}
                  </span>
                  {product.price && (
                    <span className="flex flex-wrap items-baseline gap-x-2 text-sm">
                      <span
                        className={cn(
                          "tabular font-extrabold",
                          product.price.before && "text-deal"
                        )}
                      >
                        {product.price.from
                          ? words.from.replace("{price}", product.price.current)
                          : product.price.current}
                      </span>
                      {product.price.before && (
                        <s className="tabular text-xs text-text-3">
                          <span className="sr-only">{words.priceBefore} </span>
                          {product.price.before}
                        </s>
                      )}
                      {product.price.taxNote && (
                        <span className="text-xs text-text-2">{product.price.taxNote}</span>
                      )}
                    </span>
                  )}
                </span>
              </a>
            ))}
          </Group>
        )}
        {model && side > 0 && (
          <div role="none" className="flex min-w-0 flex-col gap-3">
            {chips(words.phrases, model.phrases, true)}
            {chips(words.categories, model.categories)}
            {chips(words.brands, model.brands)}
          </div>
        )}
        {model && chips(words.browse, model.browse)}
        {model?.all && (
          <a
            role="option"
            {...option(model.all.path)}
            className={cn(OPTION, "gf-option-all lg:col-span-full")}
          >
            {words.all.replace("{count}", String(model.all.total))}
          </a>
        )}
      </div>
    </div>
  )
}
