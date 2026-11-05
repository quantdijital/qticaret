"use client"

import { ArrowRight, ShoppingBag } from "lucide-react"
import { useEffect, useState } from "react"
import { ResponsiveImage } from "@qticaret/ui"
import type { MiniCartView } from "@qticaret/ui"
import { Button } from "@qticaret/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@qticaret/ui/components/sheet"
import { FreeShippingBar } from "../cart/FreeShippingBar"
import { LineAddons } from "../components/LineAddons"
import { LineName } from "../components/LineName"

/** Sent by the purchase form when a line went in: the drawer opens to show it. */
export const CART_ADDED_EVENT = "qt:cart-added"

export interface CartDrawerWords {
  label: string
  title: string
  empty: string
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
 * a drawer with the lines and the subtotal instead. It also opens by
 * itself when a product was just added.
 */
export function CartDrawer({
  cart,
  count,
  words,
  className,
}: {
  cart: MiniCartView | null
  count: number
  words: CartDrawerWords
  className: string
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
        className={className}
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) {
            return
          }
          event.preventDefault()
          setOpen(true)
        }}
      >
        <ShoppingBag className="size-5" aria-hidden="true" />
        {count > 0 && (
          <span
            aria-hidden="true"
            className="tabular absolute top-0.5 right-0.5 flex min-w-[1.125rem] items-center justify-center rounded-full bg-highlight px-1 text-[10px] leading-[1.125rem] font-semibold text-highlight-foreground ring-2 ring-background"
          >
            {count}
          </span>
        )}
      </a>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" closeLabel={words.close} className="w-full gap-0 sm:max-w-md">
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle className="font-heading text-2xl font-normal">{words.title}</SheetTitle>
            <SheetDescription className="sr-only">{words.label}</SheetDescription>
          </SheetHeader>
          {cart ? (
            <>
              <ul className="flex flex-1 flex-col divide-y overflow-y-auto px-6">
                {cart.lines.map((line) => (
                  <li key={line.id} className="flex items-center gap-4 py-4">
                    <div className="size-16 shrink-0 overflow-hidden rounded-xl border bg-muted/50">
                      {line.image ? (
                        <ResponsiveImage
                          image={line.image}
                          sizes="64px"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span
                          aria-hidden="true"
                          className="font-heading flex h-full items-center justify-center text-2xl text-foreground/15"
                        >
                          {line.title.charAt(0).toLocaleUpperCase("tr")}
                        </span>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col text-sm">
                      <span className="truncate font-medium">
                        <LineName
                          path={line.path}
                          title={line.title}
                          onFollow={() => {
                            setOpen(false)
                          }}
                        />
                      </span>
                      <span className="text-muted-foreground">
                        {[line.detail, words.quantity.replace("{count}", String(line.quantity))]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      <LineAddons addons={line.addons} className="mt-0.5" />
                    </div>
                    <span className="tabular text-sm font-semibold">{line.total}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-4 border-t bg-card px-6 py-5">
                {/* A payment link's cart (adr/0051): its lines are fixed */}
                {cart.locked && (
                  <p role="note" className="rounded-xl border p-3 text-sm">
                    {cart.locked}
                  </p>
                )}
                {cart.freeShipping && <FreeShippingBar view={cart.freeShipping} />}
                <p className="flex items-baseline justify-between">
                  <span className="text-sm font-medium">{words.subtotal}</span>
                  <span className="tabular text-xl font-semibold">{cart.subtotal}</span>
                </p>
                <p className="-mt-2 text-xs text-muted-foreground">{words.note}</p>
                <Button asChild size="lg" className="h-12 rounded-button text-[15px]">
                  <a href="/odeme">
                    {words.checkout}
                    <ArrowRight aria-hidden="true" />
                  </a>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 rounded-button bg-transparent text-[15px] shadow-none"
                >
                  <a href="/sepet">{words.viewCart}</a>
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
              <ShoppingBag className="size-8 text-muted-foreground" aria-hidden="true" />
              <p className="text-muted-foreground">{words.empty}</p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
