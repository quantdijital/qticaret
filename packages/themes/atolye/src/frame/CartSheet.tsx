"use client"

import { ShoppingBag } from "lucide-react"
import { useEffect, useState } from "react"
import { ResponsiveImage } from "@qticaret/ui"
import type { MiniCartView } from "@qticaret/ui"
import { FreeShippingMeter } from "../parts/FreeShippingMeter"
import { CART_ADDED_EVENT, cartAddedMessage, isOwnClick } from "./events"
import { Sheet } from "./Sheet"

export interface CartSheetWords {
  /** "Sepet, 2 ürün": the header link's name. */
  label: string
  /** "Sepet", under the icon on wide screens. */
  short: string
  /** "Sepetim (2)". */
  title: string
  empty: string
  continue: string
  subtotal: string
  note: string
  viewCart: string
  checkout: string
  close: string
  /** With `{count}` where the quantity goes. */
  quantity: string
}

/**
 * The header's cart: a link to `/sepet` that, once the script runs, opens
 * a sheet from the right with the lines (read only), free shipping's
 * distance and the subtotal; "Ödemeye geç" the one filled button. It
 * opens by itself when a line went in, so no toast says so; a card's
 * quick add has its words said in the live region and the description.
 */
export function CartSheet({
  cart,
  count,
  buttonClass,
  words,
}: {
  cart: MiniCartView | null
  count: number
  buttonClass: string
  words: CartSheetWords
}) {
  const [open, setOpen] = useState(false)
  const [said, setSaid] = useState("")
  useEffect(() => {
    const show = (event: Event) => {
      setSaid(cartAddedMessage(event))
      setOpen(true)
    }
    window.addEventListener(CART_ADDED_EVENT, show)
    return () => {
      window.removeEventListener(CART_ADDED_EVENT, show)
    }
  }, [])
  return (
    <>
      <a
        href="/sepet"
        aria-label={words.label}
        className={`${buttonClass} -mr-2 lg:mr-0`}
        onClick={(event) => {
          if (isOwnClick(event)) {
            return
          }
          event.preventDefault()
          setSaid("")
          setOpen(true)
        }}
      >
        <ShoppingBag className="size-6" aria-hidden="true" strokeWidth={1.75} />
        <span aria-hidden="true" className="max-lg:hidden">
          {words.short}
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
        description={said ? `${said}. ${words.label}` : words.label}
        closeLabel={words.close}
      >
        <p role="status" className="sr-only">
          {said}
        </p>
        {cart && cart.lines.length > 0 ? (
          <>
            <ul className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 sm:px-4">
              {cart.lines.map((line) => (
                <li key={line.id} className="flex gap-3 rounded-media bg-paper-2 p-3">
                  <div className="size-18 shrink-0 overflow-hidden rounded-inner bg-paper-3">
                    {line.image && (
                      <ResponsiveImage
                        image={line.image}
                        sizes="72px"
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                    <span className="line-clamp-2 font-semibold">{line.title}</span>
                    {line.detail && line.detail.trim() !== line.title.trim() && (
                      <span className="text-text-3">{line.detail}</span>
                    )}
                    <span className="text-text-3">
                      {words.quantity.replace("{count}", String(line.quantity))}
                    </span>
                    {line.addons.map((addon, index) => (
                      <span key={`${String(index)}:${addon.label}`} className="text-text-3">
                        {addon.label}: {addon.value ?? ""}
                        {addon.amount && <span className="tabular"> ({addon.amount})</span>}
                      </span>
                    ))}
                  </div>
                  <span className="tabular text-md font-semibold">{line.total}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-4 px-4 py-5 sm:px-6">
              {cart.locked && (
                <p role="note" className="text-sm text-text-2">
                  {cart.locked}
                </p>
              )}
              {cart.freeShipping && <FreeShippingMeter view={cart.freeShipping} />}
              <p className="flex items-baseline justify-between gap-4">
                <span className="font-semibold">{words.subtotal}</span>
                <span className="tabular text-lg font-extrabold">{cart.subtotal}</span>
              </p>
              <p className="text-xs text-text-3">{words.note}</p>
              <a href="/odeme" className="gf-btn w-full">
                {words.checkout}
              </a>
              <a href="/sepet" className="gf-link self-center">
                {words.viewCart}
              </a>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-start gap-2 px-4 py-8 sm:px-6">
            <p className="text-md">{words.empty}</p>
            <a href="/" className="gf-link">
              {words.continue}
            </a>
          </div>
        )}
      </Sheet>
    </>
  )
}
