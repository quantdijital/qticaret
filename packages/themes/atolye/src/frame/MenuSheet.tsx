"use client"

import { ChevronDown, Menu, Phone } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { ContactView, LinkView, NavCategoryView } from "@qticaret/ui"
import { WhatsAppGlyph } from "../parts/WhatsAppGlyph"
import { OPEN_MENU_EVENT } from "./events"
import type { MenuWords } from "./menu-words"
import { MenuCount, MenuThumb } from "./MenuParts"
import { Sheet } from "./Sheet"

export interface MenuSheetWords extends MenuWords {
  open: string
  title: string
  close: string
  whatsapp: string
}

const ROW =
  "flex min-h-14 w-full items-center gap-3 rounded-media px-2 text-md font-semibold hover:bg-paper-2"
// A child: 48 px row, its 36 px picture under the parent's name (8 + 40 + 12 px in)
const SUB =
  "flex min-h-12 items-center gap-3 rounded-media px-2 py-1 leading-snug text-text-2 hover:bg-paper-2 hover:text-text active:bg-paper-3"
// "Tümünü gör" over the children, the category's count at its end
const ALL =
  "flex min-h-11 items-center gap-3 rounded-media px-2 text-sm font-extrabold text-text hover:bg-paper-2 active:bg-paper-3"

/**
 * The menu under 1024 px: a sheet from the left; the top categories as
 * 56 px rows, each with its picture (the shop's own, else its newest
 * product's photo) as a small rounded square, one without children with
 * its product count in a pill, one with children a native disclosure
 * that opens on a "Tümünü gör" row with the category's count and its
 * children as 48 px rows with 36 px pictures and their counts, set in
 * under the parent's name (no rule, no tree lines; a row the storefront
 * could not count shows no pill); then the shop's
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
}: {
  categories: readonly NavCategoryView[]
  topLinks: readonly LinkView[]
  contact: ContactView
  words: MenuSheetWords
}) {
  const [open, setOpen] = useState(false)
  const opener = useRef<HTMLElement | null>(null)

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
          if (opener.current) {
            event.preventDefault()
            opener.current.focus()
            opener.current = null
          }
        }}
      >
        <nav aria-label={words.title} className="flex-1 overflow-y-auto px-2 pb-6 sm:px-4">
          <ul className="flex flex-col gap-0.5">
            {categories.map((category) => (
              <li key={category.path}>
                {category.children.length === 0 ? (
                  <a href={category.path} className={ROW}>
                    <MenuThumb category={category} size={40} />
                    <span className="flex-1">{category.label}</span>
                    <MenuCount count={words.counts[category.path]} />
                  </a>
                ) : (
                  <details className="group">
                    <summary className={`${ROW} cursor-pointer`}>
                      <MenuThumb category={category} size={40} />
                      <span className="flex-1">{category.label}</span>
                      <ChevronDown
                        className="mr-2 size-5 shrink-0 group-open:rotate-180 motion-safe:transition-transform"
                        aria-hidden="true"
                        strokeWidth={1.75}
                      />
                    </summary>
                    <ul className="ml-13 flex flex-col gap-0.5 pb-3">
                      <li>
                        <a href={category.path} className={ALL}>
                          {/* Heard in full ("Tümünü gör: Çakılar"), its visible words first */}
                          <span aria-hidden="true" className="flex-1">
                            {words.seeAll}
                          </span>
                          <span className="sr-only">{words.allIn[category.path]}</span>
                          <MenuCount count={words.counts[category.path]} />
                        </a>
                      </li>
                      {category.children.map((child) => (
                        <li key={child.path}>
                          <a href={child.path} className={SUB}>
                            <MenuThumb category={child} size={36} />
                            <span className="flex-1">{child.label}</span>
                            <MenuCount count={words.counts[child.path]} />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            ))}
          </ul>
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
