"use client"

import { ResponsiveImage } from "@qticaret/ui"
import type { ImageView, PriceView } from "@qticaret/ui"

/**
 * The phone's buy bar: once the page's own "add to cart" has scrolled
 * away above, a bar slides over the bottom bar with the photo, the
 * choice that goes in (the product's name when it has none), the price
 * and the same action (it submits the page's buy form, so the chosen
 * variant, quantity and add-ons go with it); a variant to choose or one
 * out of stock leads back to the form instead. Hidden it is inert. Not
 * drawn from 1024 px, where the buy column stays beside the photographs.
 */
export function BuyBar({
  open,
  label,
  image,
  title,
  detail,
  price,
  before,
  action,
}: {
  open: boolean
  /** The bar's name for a screen reader. */
  label: string
  image: ImageView | null
  title: string
  /** The chosen options in words ("Sap rengi: Kahverengi"), shown over the price instead of the name; none: the name. */
  detail: string | null
  price: PriceView | null
  before: string
  /** The add button (submits `form`), or a link back to the form. */
  action:
    | { kind: "add"; form: string; label: string; busy: boolean }
    | { kind: "link"; href: string; label: string }
}) {
  return (
    <aside
      aria-label={label}
      data-sticky-buy=""
      data-open={open ? "true" : "false"}
      inert={!open}
      className="gf-buybar fixed inset-x-0 bottom-0 z-(--z-sticky-nav) border-t border-rule bg-paper px-4 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-float-edged lg:hidden"
    >
      <div className="mx-auto flex max-w-xl items-center gap-3">
        {image && (
          <span className="gf-stage relative size-12 shrink-0 overflow-hidden rounded-inner">
            <ResponsiveImage
              image={{ ...image, alt: "" }}
              sizes="48px"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="truncate text-xs text-text-2">{detail ?? title}</p>
          {price && (
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span
                className={`tabular text-md font-extrabold tracking-[-0.01em] ${price.before ? "text-deal" : ""}`}
              >
                {price.current}
              </span>
              {price.before && (
                <s className="tabular text-xs text-text-3">
                  <span className="sr-only">{before} </span>
                  {price.before}
                </s>
              )}
            </p>
          )}
        </div>
        {action.kind === "add" ? (
          <button
            type="submit"
            form={action.form}
            aria-busy={action.busy}
            disabled={action.busy}
            className="gf-btn shrink-0"
          >
            {action.label}
          </button>
        ) : (
          <a href={action.href} className="gf-btn shrink-0">
            {action.label}
          </a>
        )}
      </div>
    </aside>
  )
}
