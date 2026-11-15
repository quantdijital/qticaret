import { Heart, UserRound } from "lucide-react"
import type { ComponentProps } from "react"
import type { Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { CartSheet } from "./CartSheet"
import { LABELLED } from "./header-words"

/**
 * The catalog header's tools in its top row (`tools_place: row`, adr/0049
 * Ek 2026-11-15): account, favourites and the cart as the standard
 * header draws them, each with its name under it from 1024 px (the cart's
 * subtotal in place of "Sepet" when the shop asks), after the shop's
 * phone; the account once, so the strip writes no "Hesabım" beside it. A
 * phone keeps its row as before: favourites and the cart, the account in
 * the menu.
 */
export function HeaderCatalogTools({
  account,
  cart,
  total,
  alone,
  t,
}: {
  /** The account link's name (the signed-in shopper's own). */
  account: string
  cart: Omit<ComponentProps<typeof CartSheet>, "buttonClass" | "total">
  total: string | null
  /** No phone before them: they take the row's end themselves. */
  alone: boolean
  t: Translate
}) {
  return (
    <nav
      aria-label={t("nav.account")}
      className={cn("flex shrink-0 items-center lg:gap-1", alone && "lg:ml-auto")}
    >
      <a href="/hesap" aria-label={account} className={cn(LABELLED, "max-lg:hidden")}>
        <UserRound className="size-6" aria-hidden="true" strokeWidth={1.75} />
        <span aria-hidden="true">{t("nav.account")}</span>
      </a>
      {/* Named as it reads (WCAG 2.5.3): a voice user says the word on screen */}
      <a href="/hesap/favoriler" aria-label={t("nav.favorites")} className={LABELLED}>
        <Heart className="size-6" aria-hidden="true" strokeWidth={1.75} />
        <span aria-hidden="true" className="max-lg:hidden">
          {t("nav.favorites")}
        </span>
      </a>
      <CartSheet {...cart} total={total} buttonClass={LABELLED} />
    </nav>
  )
}
