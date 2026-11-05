"use client"

import { ChevronDown, Menu, MessageCircle, Phone } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { ResponsiveImage } from "@qticaret/ui"
import type { ContactView, LinkView, NavCategoryView } from "@qticaret/ui"
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
const SUB =
  "flex min-h-11 items-center rounded-inner px-4 text-text-2 hover:bg-paper-2 hover:text-text"

/** A row's picture, 40 px square; the name beside it says what it is. */
function Thumb({ category }: { category: NavCategoryView }) {
  return (
    <span className="block size-10 shrink-0 overflow-hidden rounded-inner bg-paper-3">
      {category.image && (
        <ResponsiveImage
          image={{ ...category.image, alt: "" }}
          sizes="40px"
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
 * disclosure that opens on "Tümünü gör" and its children; then the shop's
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
                        strokeWidth={2}
                      />
                    </summary>
                    <ul className="mb-2 ml-7 border-l-2 border-rule pl-2">
                      <li>
                        <a href={category.path} className={`${SUB} font-semibold text-text`}>
                          {words.allIn[category.path]}
                        </a>
                      </li>
                      {category.children.map((child) => (
                        <li key={child.path}>
                          <a href={child.path} className={SUB}>
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
                    <MessageCircle className="size-5" aria-hidden="true" strokeWidth={1.75} />
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
