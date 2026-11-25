"use client"

import { ShoppingBag } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { ResponsiveImage } from "@qticaret/ui"
import type { CategoryCardView, MiniCartView } from "@qticaret/ui"
import { CheckoutLink } from "../cart/CheckoutLink"
import { FreeShippingMeter } from "../parts/FreeShippingMeter"
import { answersCartAdded, mountCartTrigger } from "./cart-sheet-owner"
import { CartSheetLine, type SheetLineWords } from "./CartSheetLine"
import {
  CART_ADDED_EVENT,
  cartAddedMessage,
  cartAddedOrigin,
  isOwnClick,
  sheetDescription,
} from "./events"
import { Sheet } from "./Sheet"

export interface CartSheetWords {
  /** "Sepet, 2 ürün": the header link's name. */
  label: string
  /** "Sepet", under the icon on wide screens. */
  short: string
  /** "Sepetim (2)". */
  title: string
  empty: string
  /** "Kategorilere göz atın", over the empty cart's picture tiles. */
  browse: string
  continue: string
  subtotal: string
  note: string
  viewCart: string
  checkout: string
  close: string
  line: SheetLineWords
}

/** Picture tiles the empty drawer offers: the shop's first categories, two across. */
const EMPTY_TILES = 6

function EmptyCart({
  categories,
  words,
}: {
  categories: readonly CategoryCardView[]
  words: CartSheetWords
}) {
  const tiles = categories.slice(0, EMPTY_TILES)
  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 pt-2 pb-8 sm:px-6">
      <p className="flex items-center gap-3 rounded-media gf-box p-4 text-md font-semibold">
        <ShoppingBag
          className="size-6 shrink-0 text-text-3"
          aria-hidden="true"
          strokeWidth={1.75}
        />
        {words.empty}
      </p>
      {tiles.length > 0 && (
        <nav aria-label={words.browse} className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-text-2">{words.browse}</p>
          <ul className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2">
            {tiles.map((category) => (
              <li key={category.path}>
                <a
                  href={category.path}
                  className="gf-stage group relative flex aspect-[4/3] flex-col justify-end overflow-hidden rounded-media no-underline after:absolute after:inset-0 after:bg-linear-to-t after:from-stage after:from-5% after:via-stage/0 after:via-60% after:to-transparent"
                >
                  {category.image && (
                    <ResponsiveImage
                      image={{ ...category.image, alt: "" }}
                      sizes="(min-width: 640px) 180px, 46vw"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}
                  <span className="relative z-(--z-raised) px-3 pb-2.5 text-sm leading-tight font-extrabold transition-colors duration-(--dur-micro) group-hover:text-stage-text-2">
                    {category.label}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <a href="/" className="gf-btn gf-btn--quiet w-full">
        {words.continue}
      </a>
    </div>
  )
}

/**
 * What the drawer holds: free shipping's distance, the lines, the
 * subtotal and the two ways on (checkout drawn off with its reason while
 * the cart cannot go to the payment); or, empty, the shop's category tiles.
 */
export function CartSheetBody({
  cart,
  categories,
  change,
  words,
}: {
  cart: MiniCartView | null
  categories: readonly CategoryCardView[]
  change?: ((form: FormData) => Promise<void>) | undefined
  words: CartSheetWords
}) {
  // A header may hold a cart a screen width (the catalog's): the reason's id is each one's own
  const id = useId()
  if (!cart || cart.lines.length === 0) {
    return <EmptyCart categories={categories} words={words} />
  }
  return (
    <>
      {cart.freeShipping && (
        <div className="mx-4 mb-3 rounded-media gf-box px-4 py-3 sm:mx-6">
          <FreeShippingMeter view={cart.freeShipping} />
        </div>
      )}
      <ul className="flex flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-4 pb-2 sm:px-6">
        {cart.lines.map((line) => (
          <CartSheetLine
            key={line.id}
            line={line}
            change={change}
            locked={Boolean(cart.locked)}
            words={words.line}
          />
        ))}
      </ul>
      <div className="flex flex-col gap-3 bg-paper px-4 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:px-6">
        {cart.locked && (
          <p role="note" className="text-sm text-text-2">
            {cart.locked}
          </p>
        )}
        <p className="flex items-baseline justify-between gap-4">
          <span className="font-semibold">{words.subtotal}</span>
          <span className="tabular text-lg font-extrabold">{cart.subtotal}</span>
        </p>
        <p className="text-xs text-text-3">{cart.taxNote ?? cart.note ?? words.note}</p>
        <CheckoutLink
          id={`${id}-odeme-engeli`}
          label={words.checkout}
          blocked={cart.checkoutBlocked}
          className="w-full"
        />
        <a href="/sepet" className="gf-btn gf-btn--quiet w-full">
          {words.viewCart}
        </a>
      </div>
    </>
  )
}

/**
 * The header's cart: a link to `/sepet` that, once the script runs, opens
 * a sheet from the right. Free shipping's distance first, then the lines
 * (photograph, name, picks, the quantity pill and the bin, the price),
 * the subtotal, "Ödemeye geç" the one filled button and "Sepete git"
 * beside it as the quiet one. Empty, it offers the shop's categories as
 * picture tiles. It opens by itself when a line went in, so no toast says
 * so; a card's quick add has its words said in the live region.
 */
/** The element that has the focus, if any; the page itself is none (a busy button's focus drops there). */
const focusedElement = () =>
  document.activeElement instanceof HTMLElement && document.activeElement !== document.body
    ? document.activeElement
    : null

export function CartSheet({
  cart,
  count,
  categories,
  change,
  buttonClass,
  total = null,
  words,
}: {
  cart: MiniCartView | null
  count: number
  categories: readonly CategoryCardView[]
  /** The storefront's `changeCartLine`; none: the lines read only. */
  change?: ((form: FormData) => Promise<void>) | undefined
  buttonClass: string
  /** The subtotal in place of "Sepet" (the catalog header's choice); null: the word. */
  total?: string | null
  words: CartSheetWords
}) {
  const [open, setOpen] = useState(false)
  const [said, setSaid] = useState("")
  const trigger = useRef<HTMLAnchorElement>(null)
  // What had the focus when it opened: the cart link, or a card's add button
  const opener = useRef<HTMLElement | null>(null)
  const openSheet = () => {
    opener.current = focusedElement()
    setOpen(true)
  }
  useEffect(() => {
    const link = trigger.current
    if (!link) {
      return
    }
    const leave = mountCartTrigger(link)
    const show = (event: Event) => {
      // One sheet opens, the shown cart's, or the first one's when none is shown (a phone's bottom bar)
      if (!answersCartAdded(link)) {
        return
      }
      setSaid(cartAddedMessage(event))
      // The add button that sent it (Tezgâh audit Z-03), else what has the focus
      opener.current = cartAddedOrigin(event) ?? focusedElement()
      setOpen(true)
    }
    window.addEventListener(CART_ADDED_EVENT, show)
    return () => {
      window.removeEventListener(CART_ADDED_EVENT, show)
      leave()
    }
  }, [])
  return (
    <>
      <a
        ref={trigger}
        href="/sepet"
        aria-label={total ? `${words.label}, ${total}` : words.label}
        className={`${buttonClass} -mr-2 lg:mr-0`}
        onClick={(event) => {
          if (isOwnClick(event)) {
            return
          }
          event.preventDefault()
          setSaid("")
          openSheet()
        }}
      >
        <ShoppingBag className="size-6" aria-hidden="true" strokeWidth={1.75} />
        <span aria-hidden="true" className={total ? "tabular max-lg:hidden" : "max-lg:hidden"}>
          {total ?? words.short}
        </span>
        <span aria-live="polite" className="gf-count tabular empty:hidden lg:right-2">
          {count > 0 ? count : ""}
        </span>
      </a>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        side="right"
        title={words.title}
        description={sheetDescription(said, words.label)}
        closeLabel={words.close}
        onCloseAutoFocus={(event) => {
          // Back to what opened it while it is still on the page and shown, else the cart link (Tezgâh audit Y-03)
          event.preventDefault()
          const back = opener.current
          opener.current = null
          ;(back?.isConnected && back.getClientRects().length > 0 ? back : trigger.current)?.focus()
        }}
      >
        {/* A link followed from inside (a line's product, checkout, the cart) shuts it: back here, it is closed */}
        <div
          className="contents"
          onClick={(event) => {
            if (
              !isOwnClick(event) &&
              event.target instanceof Element &&
              event.target.closest("a[href]")
            ) {
              setOpen(false)
            }
          }}
        >
          <p role="status" className="sr-only">
            {said}
          </p>
          <CartSheetBody cart={cart} categories={categories} change={change} words={words} />
        </div>
      </Sheet>
    </>
  )
}
