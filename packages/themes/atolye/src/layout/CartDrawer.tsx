"use client"

import { ShoppingBag } from "lucide-react"
import { useEffect, useState } from "react"
import { ResponsiveImage } from "@qticaret/ui"
import type { MiniCartView } from "@qticaret/ui"
import { FreeShippingBar } from "../components/FreeShippingBar"
import { Drawer } from "./Drawer"
import { CART_ADDED_EVENT, isOwnClick } from "./events"

export interface CartDrawerWords {
  /** "Sepet, 2 ürün": the header link's name. */
  label: string
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
 * The header's cart (design.md § Mini cart): a link to `/sepet` that, once
 * the script runs, opens a drawer from the right with the lines (read
 * only), free shipping's distance and the subtotal; "Ödemeye geç" is the
 * one filled button, "Sepete git" a link. It opens by itself when the
 * purchase form put a line in, so no toast says so.
 */
export function CartDrawer({
  cart,
  count,
  words,
}: {
  cart: MiniCartView | null
  count: number
  words: CartDrawerWords
}) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const show = () => {
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
        className="at-icon-btn relative -mr-3"
        onClick={(event) => {
          if (isOwnClick(event)) {
            return
          }
          event.preventDefault()
          setOpen(true)
        }}
      >
        <ShoppingBag className="size-6" aria-hidden="true" strokeWidth={1.5} />
        <span
          aria-live="polite"
          className="tabular absolute top-1 right-0.5 min-w-5 bg-signal px-1 text-center text-xs leading-5 font-medium text-signal-ink empty:hidden"
        >
          {count > 0 ? count : ""}
        </span>
      </a>
      <Drawer
        open={open}
        onOpenChange={setOpen}
        side="right"
        title={words.title}
        description={words.label}
        closeLabel={words.close}
      >
        {cart && cart.lines.length > 0 ? (
          <>
            <ul className="flex-1 overflow-y-auto px-4 sm:px-6">
              {cart.lines.map((line) => (
                <li key={line.id} className="flex gap-4 border-b border-rule py-4">
                  <div className="size-16 shrink-0 overflow-hidden bg-paper-2">
                    {line.image && (
                      <ResponsiveImage
                        image={line.image}
                        sizes="64px"
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                    <span className="line-clamp-2 font-medium">{line.title}</span>
                    {line.detail && <span className="text-text-3">{line.detail}</span>}
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
                  <span className="tabular text-md font-medium">{line.total}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-4 border-t-2 border-rule-ink px-4 py-5 sm:px-6">
              {cart.locked && (
                <p role="note" className="text-sm text-text-2">
                  {cart.locked}
                </p>
              )}
              {cart.freeShipping && <FreeShippingBar view={cart.freeShipping} />}
              <p className="flex items-baseline justify-between gap-4">
                <span className="text-md font-medium">{words.subtotal}</span>
                <span className="tabular text-lg font-medium">{cart.subtotal}</span>
              </p>
              <p className="text-xs text-text-3">{words.note}</p>
              <a href="/odeme" className="at-btn w-full">
                {words.checkout}
              </a>
              <a href="/sepet" className="at-link self-center">
                {words.viewCart}
              </a>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-start gap-4 px-4 py-8 sm:px-6">
            <p className="text-md">{words.empty}</p>
            <a href="/" className="at-link">
              {words.continue}
            </a>
          </div>
        )}
      </Drawer>
    </>
  )
}
