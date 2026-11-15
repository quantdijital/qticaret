"use client"

import { ArrowRight, ChevronDown, Menu, Phone, UserRound } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { ResponsiveImage } from "@qticaret/ui"
import type { CategoryCardView, ContactView, LinkView, NavCategoryView } from "@qticaret/ui"
import { WhatsAppGlyph } from "../parts/WhatsAppGlyph"
import { OPEN_MENU_EVENT } from "./events"
import { Sheet } from "./Sheet"

export interface MenuSheetWords {
  open: string
  title: string
  close: string
  /** "Tümünü gör: {name}" for each category path. */
  allIn: Record<string, string>
  whatsapp: string
}

const ROW =
  "flex min-h-14 w-full items-center gap-3 rounded-media px-2 text-md font-semibold hover:bg-paper-2"
// A child: 48 px row, its 36 px picture under the parent's name (8 + 40 + 12 px in)
const SUB =
  "flex min-h-12 items-center gap-3 rounded-media px-2 py-1 leading-snug text-text-2 hover:bg-paper-2 hover:text-text active:bg-paper-3"

/** A row's picture as a small rounded square; the name beside it says what it is. */
function Thumb({ category, small = false }: { category: CategoryCardView; small?: boolean }) {
  return (
    <span
      className={`block shrink-0 overflow-hidden rounded-inner bg-paper-3 ${small ? "size-9" : "size-10"}`}
    >
      {category.image && (
        <ResponsiveImage
          image={{ ...category.image, alt: "" }}
          sizes={small ? "36px" : "40px"}
          className="h-full w-full object-cover"
        />
      )}
    </span>
  )
}

/**
 * The menu under 1024 px: a sheet from the left; the top categories as
 * 56 px rows, each with its picture (the shop's own, else its newest
 * product's photo) as a small rounded square, one with children a native
 * disclosure that opens on a "Tümünü gör →" text link and its children as
 * 48 px rows with 36 px pictures, set in under the parent's name (no rule,
 * no tree lines); then the shop's
 * small links and its phone and WhatsApp as quiet pills. The same links
 * are in the page's HTML through the aisle, so the sheet hides nothing
 * from a crawler. The bottom bar's "Kategoriler" opens it too, and gets
 * the focus back.
 */
export function MenuSheet({
  categories,
  topLinks,
  contact,
  words,
  highlight = null,
  account = null,
}: {
  categories: readonly NavCategoryView[]
  topLinks: readonly LinkView[]
  contact: ContactView
  words: MenuSheetWords
  /** The header's highlighted link (the catalog header's), first under the categories. */
  highlight?: LinkView | null
  /** The account's page in words, where the header has no account icon on a phone. */
  account?: LinkView | null
}) {
  const [open, setOpen] = useState(false)
  const opener = useRef<HTMLElement | null>(null)
  const button = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const show = (event: Event) => {
      event.preventDefault()
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setOpen(true)
    }
    window.addEventListener(OPEN_MENU_EVENT, show)
    return () => {
      window.removeEventListener(OPEN_MENU_EVENT, show)
    }
  }, [])

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={words.open}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          opener.current = null
          setOpen(true)
        }}
        className="gf-icon-btn -ml-2.5 lg:hidden"
      >
        <Menu className="size-6" aria-hidden="true" strokeWidth={1.75} />
      </button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        side="left"
        title={words.title}
        closeLabel={words.close}
        onCloseAutoFocus={(event) => {
          // Back to what opened it: the bottom bar's button, else the menu button
          event.preventDefault()
          ;(opener.current ?? button.current)?.focus()
          opener.current = null
        }}
      >
        <nav aria-label={words.title} className="flex-1 overflow-y-auto px-2 pb-6 sm:px-4">
          <ul className="flex flex-col gap-0.5">
            {categories.map((category) => (
              <li key={category.path}>
                {category.children.length === 0 ? (
                  <a href={category.path} className={ROW}>
                    <Thumb category={category} />
                    {category.label}
                  </a>
                ) : (
                  <details className="group">
                    <summary className={`${ROW} cursor-pointer`}>
                      <Thumb category={category} />
                      <span className="flex-1">{category.label}</span>
                      <ChevronDown
                        className="mr-2 size-5 shrink-0 group-open:rotate-180 motion-safe:transition-transform"
                        aria-hidden="true"
                        strokeWidth={1.75}
                      />
                    </summary>
                    <ul className="ml-13 flex flex-col gap-0.5 pb-3">
                      <li>
                        <a
                          href={category.path}
                          className="inline-flex min-h-11 items-center gap-1.5 rounded-button px-2 text-sm font-semibold text-text underline-offset-4 hover:underline"
                        >
                          {words.allIn[category.path]}
                          <ArrowRight
                            className="size-4 shrink-0"
                            aria-hidden="true"
                            strokeWidth={2}
                          />
                        </a>
                      </li>
                      {category.children.map((child) => (
                        <li key={child.path}>
                          <a href={child.path} className={SUB}>
                            <Thumb category={child} small />
                            {child.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            ))}
          </ul>
          {(highlight ?? account) && (
            <ul className="mt-2 flex flex-col gap-0.5 border-t border-rule pt-2">
              {highlight && (
                <li>
                  <a href={highlight.path} className={`${ROW} font-bold`}>
                    {highlight.label}
                  </a>
                </li>
              )}
              {account && (
                <li>
                  <a href={account.path} className={ROW}>
                    <UserRound className="size-6 shrink-0" aria-hidden="true" strokeWidth={1.75} />
                    {account.label}
                  </a>
                </li>
              )}
            </ul>
          )}
          {topLinks.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2 rounded-tile bg-paper-2 p-3">
              {topLinks.map((link) => (
                <li key={link.path}>
                  <a href={link.path} className="gf-chip bg-paper">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
          {(contact.phoneHref ?? contact.whatsappHref) && (
            <ul className="mt-4 flex flex-col gap-2 px-2">
              {contact.phone && contact.phoneHref && (
                <li>
                  <a href={contact.phoneHref} className="gf-btn gf-btn--quiet tabular w-full">
                    <Phone className="size-5" aria-hidden="true" strokeWidth={1.75} />
                    {contact.phone}
                  </a>
                </li>
              )}
              {contact.whatsappHref && (
                <li>
                  <a
                    href={contact.whatsappHref}
                    target="_blank"
                    rel="noopener"
                    className="gf-btn gf-btn--quiet w-full"
                  >
                    <WhatsAppGlyph className="text-whatsapp" />
                    {words.whatsapp}
                  </a>
                </li>
              )}
            </ul>
          )}
        </nav>
      </Sheet>
    </>
  )
}
