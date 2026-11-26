import { useQuery } from "@tanstack/react-query"
import { useRef } from "react"
import type { KeyboardEvent } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@qticaret/admin-ui/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import { productCatalogQuery } from "@/features/products/api/product-edit"
import type { ProductDetail } from "@/features/products/api/products"
import { PartSlot } from "@/features/products/layout/part-slot"
import { Mark } from "@/features/products/layout/part-nav"
import { TAB_KEYS } from "@/features/products/layout/parts"
import type { PartKey, TabPart } from "@/features/products/layout/parts"
import type { ShownWhy } from "@/features/products/layout/use-page-layout"
import { DataPanel } from "./data-panels"
import { DATA_CARD_ID, PRICING_TARGET, PRODUCT_SECTIONS, STOCK_TARGET } from "./sections"
import { SimpleSwitch } from "./simple-switch"
import { useSimpleVariant } from "./use-simple-variant"
import type { DataCardState, ProductType } from "./use-data-card"
import type { PartMark } from "./use-product-findings"

const D = "products.data"

// Each tab's panel by its element id ("Alana git" lands in it)
const PANEL_IDS: Record<TabPart, string> = {
  pricing: PRICING_TARGET,
  stock: STOCK_TARGET,
  shipping: PRODUCT_SECTIONS.shipping,
  attributes: PRODUCT_SECTIONS.attributes,
  variants: "product-data-variants",
  catalog: PRODUCT_SECTIONS.catalog,
  advanced: "product-data-advanced",
}

const tabId = (tab: TabPart) => `product-data-tab-${tab}`

// The tab list's keys: the arrows walk it either way (a row of chips, or a column), Home and End
const STEP: Partial<Record<string, number>> = {
  ArrowDown: 1,
  ArrowRight: 1,
  ArrowUp: -1,
  ArrowLeft: -1,
}

/**
 * The "Ürün verileri" card (docs/06 "Ürün sayfası"; WooCommerce's product
 * data box): the product's type ("Basit ürün" / "Varyantlı ürün") in its
 * header (making a product with variants simple asks in place below it),
 * then its tabs: a column on the left only where the card is wide (56rem),
 * one row of tabs over the full-width panel in a desktop's main column or
 * a tablet's (the owner 2026-11-26: the column left the panels cramped),
 * a wrapping row of chips on a phone (no row that scrolls sideways). Genel (price), Stok, Kargo (the parcel; not for a
 * digital product or a service), Özellikler, Varyantlar (a product with
 * variants), Katalog, Gelişmiş (add-ons, price history). Every panel stays
 * drawn while another is open, so an unsaved edit is kept and saved by
 * the page's header save; a tab the shop hid is left out.
 */
export function DataCard({
  product,
  state,
  slot,
  draws,
  marks,
}: {
  product: ProductDetail
  state: DataCardState
  /** How the page draws a tab: undefined when hidden, otherwise why a hidden one is shown. */
  slot: (key: PartKey) => ShownWhy | null | undefined
  draws: (key: PartKey) => boolean
  marks: (key: PartKey) => PartMark
}) {
  const { t } = useTranslation()
  const kind = useQuery(productCatalogQuery(product.id)).data?.kind
  const simple = useSimpleVariant(product, state.simple)
  const list = useRef<HTMLDivElement>(null)
  const tabs = TAB_KEYS.filter(
    (key) => (key !== "variants" || !state.simple) && draws(key) && slot(key) !== undefined
  )
  const active = tabs.includes(state.tab) ? state.tab : (tabs[0] ?? "pricing")
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const at = tabs.indexOf(active)
    const step = STEP[event.key]
    const next =
      event.key === "Home"
        ? tabs[0]
        : event.key === "End"
          ? tabs.at(-1)
          : step === undefined
            ? undefined
            : tabs[(at + step + tabs.length) % tabs.length]
    if (next) {
      event.preventDefault()
      state.pick(next)
      list.current?.querySelector<HTMLElement>(`#${tabId(next)}`)?.focus()
    }
  }
  return (
    <section
      id={DATA_CARD_ID}
      aria-labelledby="product-data-title"
      className="@container/data flex min-w-0 scroll-mt-20 flex-col rounded-lg border bg-card text-card-foreground shadow-card"
    >
      <header className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 border-b px-5 py-3">
        <h2 id="product-data-title" className="text-[15px] leading-6 font-semibold">
          {t(`${D}.title`)}
        </h2>
        <span aria-hidden="true" className="text-muted-foreground">
          —
        </span>
        <Select
          // "Basit ürün" shows while the card asks whether to make it so
          value={state.confirming ? "simple" : state.type}
          onValueChange={(value) => {
            state.setType(value as ProductType)
          }}
        >
          <SelectTrigger size="sm" className="w-auto min-w-36" aria-label={t(`${D}.type`)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="simple">{t(`${D}.types.simple`)}</SelectItem>
            <SelectItem value="variable">{t(`${D}.types.variable`)}</SelectItem>
          </SelectContent>
        </Select>
        {kind && kind !== "physical" ? (
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
            {t(`${D}.kind.${kind}`)}
          </span>
        ) : null}
      </header>
      {state.confirming ? <SimpleSwitch product={product} state={state} /> : null}
      <div className="flex min-w-0 flex-col @4xl/data:flex-row">
        <div
          ref={list}
          role="tablist"
          aria-label={t(`${D}.title`)}
          className={cn(
            "flex flex-wrap gap-1.5 border-b p-3",
            // A tablet or a desktop's main column: one row of tabs over the full-width panel
            "@xl/data:gap-x-1 @xl/data:gap-y-0 @xl/data:px-3 @xl/data:py-0",
            // Only a wide card spares the column on the left (WooCommerce's)
            "@4xl/data:w-44 @4xl/data:shrink-0 @4xl/data:flex-col @4xl/data:flex-nowrap @4xl/data:gap-0 @4xl/data:border-r @4xl/data:border-b-0 @4xl/data:bg-muted/40 @4xl/data:p-0 @4xl/data:py-1"
          )}
          onKeyDown={onKeyDown}
        >
          {tabs.map((key) => {
            const selected = key === active
            return (
              <button
                key={key}
                id={tabId(key)}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={PANEL_IDS[key]}
                tabIndex={selected ? 0 : -1}
                data-tab={key}
                className={cn(
                  "flex min-h-9 items-center gap-2 rounded-full border px-3 text-[13px] outline-none focus-visible:outline-2 focus-visible:outline-ring [html[data-input=pointer]_&]:outline-none",
                  "@xl/data:-mb-px @xl/data:min-h-11 @xl/data:gap-1.5 @xl/data:rounded-none @xl/data:border-0 @xl/data:border-b-2 @xl/data:border-transparent @xl/data:px-2.5",
                  "@4xl/data:mb-0 @4xl/data:min-h-10 @4xl/data:gap-2 @4xl/data:border-b-0 @4xl/data:border-l-2 @4xl/data:px-4 @4xl/data:text-left",
                  selected
                    ? "border-primary bg-primary/10 font-medium text-foreground @xl/data:border-primary @xl/data:bg-transparent @4xl/data:bg-card"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground @xl/data:hover:bg-transparent @4xl/data:hover:bg-muted"
                )}
                onClick={() => {
                  state.pick(key)
                }}
              >
                <span className="min-w-0 flex-1 truncate">{t(`${D}.tabs.${key}`)}</span>
                {/* A tab's tick only in the column: in a row, only what wants attention is marked */}
                <span className="flex shrink-0 items-center [&>svg]:hidden @4xl/data:[&>svg]:block">
                  <Mark mark={marks(key)} />
                </span>
              </button>
            )
          })}
        </div>
        <div className="min-w-0 flex-1">
          {tabs.map((key) => (
            <div
              key={key}
              id={PANEL_IDS[key]}
              role="tabpanel"
              aria-labelledby={tabId(key)}
              hidden={key !== active}
              className="min-w-0 scroll-mt-20 [&>[data-shown-hidden]>p:first-child]:px-5 [&>[data-shown-hidden]>p:first-child]:pt-3"
            >
              <PartSlot part={key} why={slot(key) ?? null}>
                <DataPanel
                  tab={key}
                  product={product}
                  simple={state.simple ? (simple ?? "loading") : null}
                  onVariants={() => {
                    state.pick("variants")
                  }}
                />
              </PartSlot>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
